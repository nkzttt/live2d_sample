import * as PIXI from 'pixi.js';
import * as L2DPixi from './modules/l2dpixi';
import * as L2DFrameWork from './modules/l2dframework';

PIXI.loader
    .add('moc', "/Koharu/Koharu.moc3", { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER })
    .add('texture', "/Koharu/Koharu.png")
    .add('motion', "/Koharu/Koharu.motion3.json", { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })
    .load((loader: PIXI.loaders.Loader, resources: PIXI.loaders.ResourceDictionary) => {
        // Create app.
        let app = new PIXI.Application(1280, 720, {backgroundColor : 0x1099bb});


        document.body.appendChild(app.view);


        // Load moc.
        let moc = Live2DCubismCore.Moc.fromArrayBuffer(resources['moc'].data);


        // Create model.
        let model = new L2DPixi.ModelBuilder()
            .setMoc(moc)
            .setTimeScale(1)
            .addTexture(0, resources['texture'].texture)
            .addAnimatorLayer("base", L2DFrameWork.BuiltinAnimationBlenders.OVERRIDE, 1)
            .build();


        // Add model to stage.
        app.stage.addChild(model);
        app.stage.addChild(model.masks);


        // Load animation.
        let animation = L2DFrameWork.Animation.fromMotion3Json(resources['motion'].data);


        // Play animation.
        model.animator
            .getLayer("base")
            .play(animation);


        // Set up ticker.
        app.ticker.add((deltaTime) => {
            model.update(deltaTime);
            model.masks.update(app.renderer);
        });


        // Do that responsive design...
        let onResize = function (event: any = null) {
            // Keep 16:9 ratio.
            var width = window.innerWidth;
            var height = (width / 16.0) * 9.0;


            // Resize app.
            app.view.style.width = width + "px";
            app.view.style.height = height + "px";

            app.renderer.resize(width, height);


            // Resize model.
            model.position = new PIXI.Point((width * 0.5), (height * 0.5));
            model.scale = new PIXI.Point((model.position.x * 0.8), (model.position.x * 0.8));

            // Resize mask texture.
            model.masks.resize(app.view.width, app.view.height);

        };
        onResize();
        window.onresize = onResize;


        // TODO Clean up properly.
    });

