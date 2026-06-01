#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(FaceCaptureViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(onFaceProcessed, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onLivenessUpdate, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onStatusMessage, RCTDirectEventBlock)

@end
