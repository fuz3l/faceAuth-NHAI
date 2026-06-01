package com.datalakefaceauth

import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class FaceCaptureViewManager : SimpleViewManager<FaceCaptureView>() {

    override fun getName(): String {
        return "FaceCaptureView"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): FaceCaptureView {
        return FaceCaptureView(reactContext)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any>? {
        val builder = MapBuilder.builder<String, Any>()
        
        // Export the events to React Native
        builder.put("onFaceProcessed", MapBuilder.of("registrationName", "onFaceProcessed"))
        builder.put("onLivenessUpdate", MapBuilder.of("registrationName", "onLivenessUpdate"))
        builder.put("onStatusMessage", MapBuilder.of("registrationName", "onStatusMessage"))
        
        return builder.build()
    }
}
