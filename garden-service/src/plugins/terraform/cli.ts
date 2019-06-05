/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { BinaryCmd } from "../../util/ext-tools"
import { ConfigurationError } from "../../exceptions"
import { TerraformProvider } from "./terraform"

export function terraform(provider: TerraformProvider) {
  const version = provider.config.version
  const cli = terraformClis[version]

  if (!cli) {
    throw new ConfigurationError(`Unsupported Terraform version: ${version}`, { version, supportedVersions })
  }

  return cli
}

export const terraformClis: { [version: string]: BinaryCmd } = {
  "0.11.14": new BinaryCmd({
    name: "terraform-0.11.14",
    specs: {
      darwin: {
        url: "https://releases.hashicorp.com/terraform/0.11.14/terraform_0.11.14_darwin_amd64.zip",
        sha256: "829bdba148afbd61eab4aafbc6087838f0333d8876624fe2ebc023920cfc2ad5",
      },
      linux: {
        url: "https://releases.hashicorp.com/terraform/0.11.14/terraform_0.11.14_linux_amd64.zip",
        sha256: "9b9a4492738c69077b079e595f5b2a9ef1bc4e8fb5596610f69a6f322a8af8dd",
      },
      win32: {
        url: "https://releases.hashicorp.com/terraform/0.11.14/terraform_0.11.14_windows_amd64.zip",
        sha256: "bfec66e2ad079a1fab6101c19617a82ef79357dc1b92ddca80901bb8d5312dc0",
      },
    },
  }),
  "0.12.5": new BinaryCmd({
    name: "terraform-0.12.5",
    specs: {
      darwin: {
        url: "https://releases.hashicorp.com/terraform/0.12.5/terraform_0.12.5_darwin_amd64.zip",
        sha256: "e0afcf6f6401e9eaab0be588b55b5226549253854acc1d0cde331b8ca54727e0",
      },
      linux: {
        url: "https://releases.hashicorp.com/terraform/0.12.5/terraform_0.12.5_linux_amd64.zip",
        sha256: "babb4a30b399fb6fc87a6aa7435371721310c2e2102a95a763ef2c979ab06ce2",
      },
      win32: {
        url: "https://releases.hashicorp.com/terraform/0.12.5/terraform_0.12.5_windows_amd64.zip",
        sha256: "6b720bf935f3c121430612ca10850dcd457f4d74d2b756baadcec50fb6feac20",
      },
    },
  }),
}

export const supportedVersions = Object.keys(terraformClis)
