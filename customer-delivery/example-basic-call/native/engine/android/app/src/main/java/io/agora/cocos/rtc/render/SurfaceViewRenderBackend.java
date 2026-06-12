package io.agora.cocos.rtc.render;

import android.app.Activity;
import android.view.SurfaceView;
import android.view.View;

public final class SurfaceViewRenderBackend extends AbstractNativeViewRenderBackend {
    @Override
    public String getType() {
      return "surface-view";
    }

    @Override
    protected View createRendererView(Activity activity, boolean local) {
      SurfaceView rendererView = new SurfaceView(activity);
      rendererView.setZOrderMediaOverlay(true);
      return rendererView;
    }
}
