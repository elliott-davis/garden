variable "cluster-hostname" {
  type = "string"
  description = "The hostname to be created for your cluster. The domain should be owned by you, and controlled via Google Cloud DNS."
}
variable "acme-email-address" {
  type = "string"
  description = "The email address to use when generating your TLS certificate via Let's Encrypt."
}

provider "acme" {
  server_url = "https://acme-staging-v02.api.letsencrypt.org/directory"
}

resource "tls_private_key" "private_key" {
  algorithm = "RSA"
}

resource "acme_registration" "reg" {
  account_key_pem = "${tls_private_key.private_key.private_key_pem}"
  email_address   = "${var.acme-email-address}"
}

resource "acme_certificate" "certificate" {
  account_key_pem           = "${acme_registration.reg.account_key_pem}"
  common_name               = "${var.cluster-hostname}"
  subject_alternative_names = ["${var.cluster-hostname}"]

  dns_challenge {
    provider = "gcloud"

    config {
      GCE_PROJECT              = "${var.gcp-project-id}"
      GCE_SERVICE_ACCOUNT_FILE = "${var.gcp-credentials-file}"
    }
  }
}

resource "kubernetes_secret" "garden-example-tls" {
  type = "kubernetes.io/tls"

  metadata {
    name = "garden-example-tls"
  }

  data {
    key = "${acme_certificate.private_key_pem}"
    crt = "${acme_certificate.certificate_pem}"
  }
}
