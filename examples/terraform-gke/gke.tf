variable "gcp-project-id" {
  type        = "string"
  description = "The project ID where we'll create the GKE cluster and related resources."
}

variable "gcp-region" {
  type        = "string"
  description = "The region where we'll create your resources (e.g. us-central1)."
  default     = "us-central1"
}

variable "gcp-credentials-file" {
  type        = "string"
  description = "The path (relative to the project root) to your JSON authentication file for the project."
  default     = "account.json"
}

variable "gke-master-username" {
  # REPLACE THIS FOR PRODUCTION
  default = "mr.yoda"
}

variable "gke-master-password" {
  # REPLACE THIS FOR PRODUCTION
  default = "adoy.rm"
}

provider "google" {
  credentials = "${file("${var.gcp-credentials-file}")}"
  project     = "${var.gcp-project-id}"
  region      = "${var.gcp-region}"
  zone        = "${var.gcp-region}-a"
}

# See all available options at https://www.terraform.io/docs/providers/google/r/container_cluster.html
resource "google_container_cluster" "primary" {
  name               = "my-gke-cluster"
  zone               = "${var.region}-a"
  initial_node_count = 1

  master_auth {
    username = "${var.gke-master-username}"
    password = "${var.gke-master-password}"
  }

  node_config {
    oauth_scopes = [
      "https://www.googleapis.com/auth/compute",
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
    ]
  }
}

# Set up static IP for ingress and a DNS record
resource "google_compute_address" "gke_static_ip" {
  name = "gke-ingress-ip"
}

resource "google_dns_managed_zone" "example" {
  name     = "gke-example-zone"
  dns_name = "${var.cluster-hostname}."
}

resource "google_dns_record_set" "a" {
  name         = "backend.${google_dns_managed_zone.example.dns_name}"
  managed_zone = "${google_dns_managed_zone.example.name}"
  type         = "A"
  ttl          = 300

  rrdatas = ["${google_compute_address.gke_static_ip.address}"]
}

# The following outputs allow authentication and connectivity to the GKE Cluster.
output "gcp_project_id" {
  value = "${var.gcp-project-id}"
}

output "gke_hostname" {
  value = "${var.cluster-hostname}"
}

output "gke_master_ip" {
  value = "${google_container_cluster.primary.endpoint}"
}

output "gke_client_certificate" {
  value = "${google_container_cluster.primary.master_auth.0.client_certificate}"
}

output "gke_client_key" {
  value = "${google_container_cluster.primary.master_auth.0.client_key}"
}

output "gke_cluster_ca_certificate" {
  value = "${google_container_cluster.primary.master_auth.0.cluster_ca_certificate}"
}

# Set up nginx ingress controller (all requests will be routed through this)
provider "helm" {
  kubernetes {
    host     = "https://${google_container_cluster.primary.endpoint}"
    username = "${var.gke-master-username}"
    password = "${var.gke-master-password}"

    client_certificate     = "${output.gke_client_certificate}"
    client_key             = "${output.gke_client_key}"
    cluster_ca_certificate = "${output.gke_cluster_ca_certificate}"
  }
}

resource "helm_release" "nginx" {
  name  = "nginx"
  chart = "stable/nginx-ingress"
  namespace = "kube-system"

  set {
    name  = "controller.service.loadBalancerIP"
    value = "${google_compute_address.gke_static_ip.address}"
  }
}
