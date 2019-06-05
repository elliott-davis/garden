# Terraform + GKE example

This example takes the [remote-k8s example](../remote-k8s) and automates most of the steps
using the Terraform provider, including spinning up a GKE cluster, configuring TLS certificates
and DNS.

## Setup

### Step 1 - Create a GCP project

Go to the [Google Cloud console](https://console.cloud.google.com) or create a new project via the
`gcloud` command line tool. Take note of the project ID.

### Step 2 - Create a service account and authentication file

Go to the [Create service account key](https://console.cloud.google.com/apis/credentials/serviceaccountkey)
page in the Google Cloud console, and make sure you have your newly created project open.

Choose _"New service account"_ from the dropdown, give it any name, and select the _Project > Editor_ role
(you'll want more constrained permissions for real-world projects, but this will do for the example).
Keep the JSON option selected and click _Create_ to download the credentials file. You'll provide the
path to this file in the next step.

### Step 3 - Configure the environment

The Terraform stack needs some input values from you. You can provide those in a couple of different ways:

**A)** The simplest way to do this is to run `garden init env`. Terraform will then ask you to input
the variables it needs values for.

**B)** You can also configure the variables directly in the project `garden.yml` (see the commented section),
or you can supply the values in a `terraform.tfvars` file in the example root directory. If you do this,
you do not need to run `garden init env` separately.

### Step 4 - Deploy your services

To deploy your services to your new GKE cluster, run `garden deploy`. And that's it!

### Step 5 - Cleanup

Simply delete your GCP project via the Google Cloud console.
