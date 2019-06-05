/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { GardenPlugin } from "../../types/plugin/plugin"
import { ProviderConfig, providerConfigBaseSchema, Provider } from "../../config/provider"
import { PrimitiveMap, joiVariables, joi } from "../../config/common"
import { deline } from "../../util/string"
import { supportedVersions } from "./cli"
// import { ConfigureProviderParams, ConfigureProviderResult } from "../../types/plugin/provider/configureProvider"
import { getEnvironmentStatus, prepareEnvironment } from "./init"

interface TerraformProviderConfig extends ProviderConfig {
  autoApply: boolean
  root: string
  variables: PrimitiveMap
  version: string
}

export interface TerraformProvider extends Provider<TerraformProviderConfig> { }

// Default to latest
const defaultVersion = supportedVersions[supportedVersions.length - 1]

const configSchema = providerConfigBaseSchema
  .keys({
    autoApply: joi.boolean()
      .default(false)
      .description(deline`
        If set to true, Garden will automatically run \`terraform apply -auto-approve\` when the stack is not
        up-to-date. Otherwise, a warning is logged if the stack is out-of-date, and an error thrown if it is missing
        entirely.
      `),
    root: joi.string()
      .posixPath({ subPathOnly: true })
      .default(".")
      .description("The directory, relative to the project root, containing the Terraform configuration files."),
    variables: joiVariables()
      .description(deline`
        A map of variables to use when applying the Terraform stack. You can define these here, or place a
        \`terraform.tfvars\` file in the project root.
      `),
    version: joi.string()
      .allow(...supportedVersions)
      .default(defaultVersion)
      .description(deline`
        The version of Terraform to use.
      `),
  })

export const gardenPlugin = (): GardenPlugin => ({
  configSchema,
  actions: {
    // configureProvider,
    getEnvironmentStatus,
    prepareEnvironment,
  },
})

// async function configureProvider({ }: ConfigureProviderParams): Promise<ConfigureProviderResult> {
//   TODO: Discover which input variables are required and check for their presence here
// }
