/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { resolve } from "path"
import { readFile } from "fs-extra"
import * as Bluebird from "bluebird"
import { flatten, set, uniq } from "lodash"
import { safeLoadAll } from "js-yaml"

import { KubernetesModule, configureKubernetesModule, KubernetesService, describeType } from "./config"
import { getNamespace, getAppNamespace } from "../namespace"
import { KubernetesPluginContext } from "../config"
import { KubernetesResource } from "../types"
import { ServiceStatus } from "../../../types/service"
import { compareDeployedObjects, waitForResources } from "../status/status"
import { KubeApi } from "../api"
import { ModuleAndRuntimeActions } from "../../../types/plugin/plugin"
import { getAllLogs } from "../logs"
import { deleteObjectsByLabel, apply } from "../kubectl"
import { BuildModuleParams, BuildResult } from "../../../types/plugin/module/build"
import { GetServiceStatusParams } from "../../../types/plugin/service/getServiceStatus"
import { DeployServiceParams } from "../../../types/plugin/service/deployService"
import { DeleteServiceParams } from "../../../types/plugin/service/deleteService"
import { GetServiceLogsParams } from "../../../types/plugin/service/getServiceLogs"
import { gardenAnnotationKey } from "../../../util/string"

export const kubernetesHandlers: Partial<ModuleAndRuntimeActions<KubernetesModule>> = {
  build,
  configure: configureKubernetesModule,
  deleteService,
  deployService,
  describeType,
  getServiceLogs,
  getServiceStatus,
}

async function build({ module }: BuildModuleParams<KubernetesModule>): Promise<BuildResult> {
  // Get the manifests here, just to validate that the files are there and are valid YAML
  await getManifests(module)
  return { fresh: true }
}

async function getServiceStatus(
  { ctx, module, log }: GetServiceStatusParams<KubernetesModule>,
): Promise<ServiceStatus> {
  const k8sCtx = <KubernetesPluginContext>ctx
  const namespace = await getNamespace({
    log,
    projectName: k8sCtx.projectName,
    provider: k8sCtx.provider,
    skipCreate: true,
  })
  const context = ctx.provider.config.context
  const api = await KubeApi.factory(log, context)
  const manifests = await getManifests(module)

  const { state, remoteObjects } = await compareDeployedObjects(k8sCtx, api, namespace, manifests, log, false)

  return {
    state,
    version: state === "ready" ? module.version.versionString : undefined,
    detail: { remoteObjects },
  }
}

async function deployService(
  params: DeployServiceParams<KubernetesModule>,
): Promise<ServiceStatus> {
  const { ctx, force, module, service, log } = params

  const k8sCtx = <KubernetesPluginContext>ctx
  const namespace = await getNamespace({
    log,
    projectName: k8sCtx.projectName,
    provider: k8sCtx.provider,
    skipCreate: true,
  })
  const context = ctx.provider.config.context
  const manifests = await getManifests(module)

  const pruneSelector = getSelector(service)
  await apply({ log, context, manifests, force, namespace, pruneSelector })

  await waitForResources({
    ctx: k8sCtx,
    provider: k8sCtx.provider,
    serviceName: service.name,
    resources: manifests,
    log,
  })

  return getServiceStatus(params)
}

async function deleteService(params: DeleteServiceParams): Promise<ServiceStatus> {
  const { ctx, log, service, module } = params
  const k8sCtx = <KubernetesPluginContext>ctx
  const namespace = await getAppNamespace(k8sCtx, log, k8sCtx.provider)
  const provider = k8sCtx.provider
  const manifests = await getManifests(module)

  const context = provider.config.context
  await deleteObjectsByLabel({
    log,
    context,
    namespace,
    labelKey: gardenAnnotationKey("service"),
    labelValue: service.name,
    objectTypes: uniq(manifests.map(m => m.kind)),
    includeUninitialized: false,
  })

  return getServiceStatus({ ...params, hotReload: false })
}

async function getServiceLogs(params: GetServiceLogsParams<KubernetesModule>) {
  const { ctx, log, module } = params
  const k8sCtx = <KubernetesPluginContext>ctx
  const context = k8sCtx.provider.config.context
  const namespace = await getAppNamespace(k8sCtx, log, k8sCtx.provider)
  const manifests = await getManifests(module)

  return getAllLogs({ ...params, context, namespace, resources: manifests })
}

function getSelector(service: KubernetesService) {
  return `${gardenAnnotationKey("service")}=${service.name}`
}

async function getManifests(module: KubernetesModule): Promise<KubernetesResource[]> {
  const fileManifests = flatten(await Bluebird.map(module.spec.files, async (path) => {
    const absPath = resolve(module.buildPath, path)
    return safeLoadAll((await readFile(absPath)).toString())
  }))

  const manifests = [...module.spec.manifests, ...fileManifests]

  // Add a label, so that we can identify the manifests as part of this module, and prune if needed
  return manifests.map(manifest => {
    set(manifest, ["metadata", "annotations", gardenAnnotationKey("service")], module.name)
    set(manifest, ["metadata", "labels", gardenAnnotationKey("service")], module.name)
    return manifest
  })
}
