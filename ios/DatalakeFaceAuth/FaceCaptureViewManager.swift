import Foundation
import React

@objc(FaceCaptureViewManager)
class FaceCaptureViewManager: RCTViewManager {
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func view() -> UIView! {
        return FaceCaptureView()
    }
}
