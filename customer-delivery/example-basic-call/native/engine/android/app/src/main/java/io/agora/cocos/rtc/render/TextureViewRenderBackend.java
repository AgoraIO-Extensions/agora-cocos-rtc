package io.agora.cocos.rtc.render;

import android.app.Activity;
import android.view.TextureView;
import android.view.View;

public final class TextureViewRenderBackend extends AbstractNativeViewRenderBackend {
    @Override
    public String getType() {
      return "texture-view";
    }

    @Override
    protected View createRendererView(Activity activity, boolean local) {
      TextureView rendererView = new TextureView(activity);
      rendererView.setOpaque(false);
      return rendererView;
    }
}
