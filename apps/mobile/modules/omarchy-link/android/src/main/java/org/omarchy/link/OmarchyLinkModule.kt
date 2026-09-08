package org.omarchy.link

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OmarchyLinkModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OmarchyLink")

    AsyncFunction("requestAsync") Coroutine { optionsJson: String ->
      throw IllegalStateException("Android pinned transport is not implemented yet")
    }

    AsyncFunction("uploadAsync") Coroutine { optionsJson: String ->
      throw IllegalStateException("Android pinned upload is not implemented yet")
    }

    AsyncFunction("discoverAsync") Coroutine { timeoutMs: Double ->
      "[]"
    }
  }
}
