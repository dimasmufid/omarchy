package org.omarchy.link

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class OmarchyLinkModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("OmarchyLink")

    AsyncFunction("requestAsync") Coroutine { optionsJson: String ->
      withContext(Dispatchers.IO) { PinnedTransport.execute(context, optionsJson, false) }
    }

    AsyncFunction("uploadAsync") Coroutine { optionsJson: String ->
      withContext(Dispatchers.IO) { PinnedTransport.execute(context, optionsJson, true) }
    }

    AsyncFunction("discoverAsync") Coroutine { timeoutMs: Double ->
      BonjourDiscovery.discover(context, timeoutMs.toLong())
    }
  }
}
