/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { join } from "path"

import { expect } from "chai"
import { readFile, pathExists, remove } from "fs-extra"

import { getDataDir, makeTestGarden } from "../../../../helpers"
import { findByName } from "../../../../../src/util/util"

describe("Terraform provider", () => {
  const testRoot = getDataDir("test-projects", "terraform")
  const testFilePath = join(testRoot, "tf", "test.log")

  afterEach(async () => {
    if (await pathExists(testFilePath)) {
      await remove(testFilePath)
    }
  })

  it("should apply a stack on init and use configured variables", async () => {
    const garden = await makeTestGarden(testRoot)
    await garden.resolveProviders()

    const testFileContent = await readFile(testFilePath)
    expect(testFileContent).to.equal("foo!")
  })

  it("should expose outputs to template contexts", async () => {
    const garden = await makeTestGarden(testRoot)
    const providers = await garden.resolveProviders()
    const testProvider = findByName(providers, "test-plugin")!
    expect(testProvider.config["my-output"]).to.equal("foo!")
  })
})
