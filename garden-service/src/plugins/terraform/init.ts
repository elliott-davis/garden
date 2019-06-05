/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { resolve } from "path"
import { startCase } from "lodash"

import { ConfigurationError, PluginError } from "../../exceptions"
import { LogEntry } from "../../logger/log-entry"
import { dedent } from "../../util/string"
import { terraform } from "./cli"
import { TerraformProvider } from "./terraform"
import { GetEnvironmentStatusParams, EnvironmentStatus } from "../../types/plugin/provider/getEnvironmentStatus"
import { PrepareEnvironmentParams, PrepareEnvironmentResult } from "../../types/plugin/provider/prepareEnvironment"
import { PluginContext } from "../../plugin-context"

export async function getEnvironmentStatus({ ctx, log }: GetEnvironmentStatusParams): Promise<EnvironmentStatus> {
  const provider = ctx.provider as TerraformProvider
  await tfValidate(ctx, log, provider)

  const plan = await terraform(provider).exec({
    log,
    ignoreError: true,
    args: ["plan", "-detailed-exitcode", "-input=false"],
  })

  if (plan.code === 0) {
    // Stack is up-to-date
    const outputs = await getTfOutputs(log, provider)
    return { ready: true, outputs }
  } else if (plan.code === 1) {
    // Error from terraform. This can, for example, happen if variables are missing or there are errors in the tf files.
    throw new ConfigurationError(`terraform plan returned an error:\n${plan.stderr}`, {
      output: plan.stderr,
    })
  } else if (plan.code === 2) {
    // No error but stack is not up-to-date
    if (provider.config.autoApply) {
      // Trigger the prepareEnvironment handler
      return { ready: false, outputs: {} }
    } else {
      log.warn(
        "Terraform stack is not up-to-date and `autoApply` is not enabled. Please run `terraform apply` to make sure " +
        "the stack is in the intended state.",
      )
      const outputs = await getTfOutputs(log, provider)
      return { ready: true, outputs }
    }
  } else {
    throw new PluginError(`Unexpected exit code from \`terraform plan\`: ${plan.code}`, {
      code: plan.code,
      stderr: plan.stderr,
      stdout: plan.stdout,
    })
  }
}

export async function prepareEnvironment({ ctx, log }: PrepareEnvironmentParams): Promise<PrepareEnvironmentResult> {
  const provider = ctx.provider as TerraformProvider

  if (provider.config.autoApply) {
    await terraform(provider).exec({ log, args: ["apply", "-auto-approve", "-input=false"] })
  }

  return {
    status: {
      ready: true,
      outputs: await getTfOutputs(log, provider),
    },
  }
}

async function tfValidate(ctx: PluginContext, log: LogEntry, provider: TerraformProvider) {
  const args = ["validate", "-json"]
  const root = getRoot(ctx, provider)
  const res = await terraform(provider).json({ log, args, ignoreError: true, cwd: root })

  if (res.valid === "false") {
    const reasons = res.diagnostics.map((d: any) => d.summary)

    if (reasons.includes("Could not satisfy plugin requirements")) {
      // We need to run `terraform init` and retry validation
      log.info("Initializing Terraform")
      await terraform(provider).exec({ log, args: ["init"] })

      const retryRes = await terraform(provider).json({ log, args, ignoreError: true, cwd: root })
      if (retryRes.valid === "false") {
        throw validationError(retryRes)
      }

    } else {
      throw validationError(res)
    }
  }
}

async function getTfOutputs(log: LogEntry, provider: TerraformProvider) {
  return terraform(provider).json({ log, args: ["outputs", "-json"] })
}

function getRoot(ctx: PluginContext, provider: TerraformProvider) {
  return resolve(ctx.projectRoot, provider.config.root)
}

function validationError(result: any) {
  const errors = result.diagnostics.map((d: any) => `${startCase(d.severity)}: ${d.summary}\n${d.detail || ""}`)
  return new ConfigurationError(dedent`Failed validating Terraform configuration:\n\n${errors.join("\n")}`, {
    result,
  })
}
