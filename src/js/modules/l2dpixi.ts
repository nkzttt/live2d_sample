import * as PIXI from 'pixi.js';
import * as L2DFrameWork from './l2dframework';

/** PIXI Cubism model wrapper. */
export class Model extends PIXI.Container {
    /** Parameters. */
    public get parameters(): Live2DCubismCore.Parameters {
        return this._coreModel.parameters;
    }
    /** Parts. */
    public get parts(): Live2DCubismCore.Parts {
        return this._coreModel.parts;
    }
    /** Drawables. */
    public get drawables(): Live2DCubismCore.Drawables {
        return this._coreModel.drawables;
    }
    /** Canvas information */
    public get canvasinfo(): Live2DCubismCore.CanvasInfo{
        return this._coreModel.canvasinfo;
    }
    /** Textures. */
    public get textures():Array<PIXI.Texture> {
        return this._textures;
    }
    /** Animator. */
    public get animator(): L2DFrameWork.Animator {
        return this._animator;
    }
    /** User data. */
    public get userData(): L2DFrameWork.UserData {
        return this._userData;
    }
    /** Drawable meshes. */
    public get meshes(): Array<CubismMesh> {
        return this._meshes;
    }
    /** Rendarable mask sprites. */
    public get masks(): MaskSpriteContainer{
        return this._maskSpriteContainer;
    }
    /**Group objects for bind some parameters. */
    public get groups(): L2DFrameWork.Groups {
        return this._groups;
    }

    /** Updates model including graphic resources. */
    public update(delta: number): void {
        // Patch delta time (as Pixi's delta references performance?)
        let deltaTime = 0.016 * delta;


        // Update components.
        this._animator.updateAndEvaluate(deltaTime);
        if (this._physicsRig) {
            this._physicsRig.updateAndEvaluate(deltaTime);
        }


        // Update model.
        this._coreModel.update();


        // Sync draw data.
        let sort = false;
        for (let m = 0; m < this._meshes.length; ++m) {
            // Sync opacity and visiblity.
            this._meshes[m].alpha = this._coreModel.drawables.opacities[m];
            this._meshes[m].visible = Live2DCubismCore.Utils.hasIsVisibleBit(this._coreModel.drawables.dynamicFlags[m]);
            // Sync vertex positions if necessary.
            if (Live2DCubismCore.Utils.hasVertexPositionsDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
                this._meshes[m].vertices = this._coreModel.drawables.vertexPositions[m];
                this._meshes[m].dirtyVertex = true;
            }
            // Update render order if necessary.
            if (Live2DCubismCore.Utils.hasRenderOrderDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
                sort = true;
            }
        }


        // TODO Profile.
        if (sort) {
            this.children.sort((a, b) => {
                let aIndex = this._meshes.indexOf(a as CubismMesh);
                let bIndex = this._meshes.indexOf(b as CubismMesh);
                let aRenderOrder = this._coreModel.drawables.renderOrders[aIndex];
                let bRenderOrder = this._coreModel.drawables.renderOrders[bIndex];


                return aRenderOrder - bRenderOrder;
            });
        }


        this._coreModel.drawables.resetDynamicFlags();
    }

    /** Destroys model. */
    public destroy(options?: any): void {
        // Release model.
        if (this._coreModel != null) {
            this._coreModel.release();
        }


        // Release base.
        super.destroy(options);

        // Explicitly release masks.
        this.masks.destroy();

        // Explicitly release meshes.
        this._meshes.forEach((m) => {
            m.destroy();
        });


        // Optionally destroy textures.
        if (options == true || options.texture) {
            this._textures.forEach((t) => {
                t.destroy();
            });
        }
    }

    public getModelMeshById(id: string): CubismMesh{
        // Deserialize user data.
        if(this._meshes == null)
            return null;

        for(let mesh of this._meshes){
            if(mesh.name === id)
                return mesh;
        }
        return null;
    }

    /**
     * Creates model.
     *
     * @param moc Moc.
     * @param textures Textures.
     * @param animator Animator.
     * @param physicsRig [Optional] Physics rig.
     *
     * @return Model on success; 'null' otherwise.
     */
    public static _create(coreModel: Live2DCubismCore.Model, textures: Array<PIXI.Texture>, animator: L2DFrameWork.Animator,
                          physicsRig: L2DFrameWork.PhysicsRig = null, userData: L2DFrameWork.UserData = null, groups: L2DFrameWork.Groups = null)
        : Model {
        let model = new Model(coreModel, textures, animator, physicsRig, userData, groups);


        if (!model.isValid) {
            model.destroy();


            return null;
        }


        return model;
    }


    /** Cubism model. */
    private _coreModel: Live2DCubismCore.Model;
    /** Drawable textures. */
    private _textures: Array<PIXI.Texture>;
    /** Animator. */
    private _animator: L2DFrameWork.Animator;
    /** Physics rig. */
    private _physicsRig: L2DFrameWork.PhysicsRig;
    /** User data. */
    private _userData: L2DFrameWork.UserData;
    /** Drawable meshes. */
    private _meshes: Array<CubismMesh>;
    /** Rendarable mask sprites. */
    private _maskSpriteContainer: MaskSpriteContainer;
    /** Off screen rendarable mask meshes. */
    private _maskMeshContainer: PIXI.Container;
    /** Group objects for bind some parameters */
    private _groups: L2DFrameWork.Groups;

    /**
     * Creates instance.
     *
     * @param moc Moc.
     * @param textures Textures.
     */
    private constructor(coreModel: Live2DCubismCore.Model, textures: Array<PIXI.Texture>, animator: L2DFrameWork.Animator,
                        physicsRig: L2DFrameWork.PhysicsRig, userData: L2DFrameWork.UserData, groups: L2DFrameWork.Groups)
    {
        // Initialize base class.
        super();


        // Store arguments.
        this._coreModel = coreModel;
        this._textures = textures;
        this._animator = animator;
        this._physicsRig = physicsRig;
        this._userData = userData;
        this._groups = groups;
        this._animator.groups = this._groups;

        // Return early if model instance creation failed.
        if (this._coreModel == null) {
            return;
        }


        // Create meshes.
        this._meshes = new Array<CubismMesh>(this._coreModel.drawables.ids.length);


        for (let m = 0; m < this._meshes.length; ++m) {
            // Patch uvs.
            let uvs = this._coreModel.drawables.vertexUvs[m].slice(0, this._coreModel.drawables.vertexUvs[m].length);


            for (var v = 1; v < uvs.length; v += 2) {
                uvs[v] = 1 - uvs[v];
            }


            // Create mesh.
            this._meshes[m] = new CubismMesh(
                textures[this._coreModel.drawables.textureIndices[m]],
                this._coreModel.drawables.vertexPositions[m],
                uvs,
                this._coreModel.drawables.indices[m],
                PIXI.DRAW_MODES.TRIANGLES);

            // Set mesh name by cubism drawables ID.
            this._meshes[m].name = this._coreModel.drawables.ids[m];

            // HACK Flip mesh...
            this._meshes[m].scale.y *= -1;


            // Set culling flag.
            this._meshes[m].isCulling = !Live2DCubismCore.Utils.hasIsDoubleSidedBit(this._coreModel.drawables.constantFlags[m]);


            if (Live2DCubismCore.Utils.hasBlendAdditiveBit(this._coreModel.drawables.constantFlags[m])) {
                // Masked mesh is disabled additive blending mode.
                // https://github.com/pixijs/pixi.js/issues/3824
                if(this._coreModel.drawables.maskCounts[m] > 0){
                    var addFilter= new PIXI.Filter();
                    addFilter.blendMode = PIXI.BLEND_MODES.ADD;
                    this._meshes[m].filters = [addFilter];
                }else{
                    this._meshes[m].blendMode = PIXI.BLEND_MODES.ADD;
                }
            }
            else if (Live2DCubismCore.Utils.hasBlendMultiplicativeBit(this._coreModel.drawables.constantFlags[m])) {
                // Masked mesh is disabled multiply blending mode.
                // https://github.com/pixijs/pixi.js/issues/3824
                if(this._coreModel.drawables.maskCounts[m] > 0){
                    var multiplyFilter= new PIXI.Filter();
                    multiplyFilter.blendMode = PIXI.BLEND_MODES.MULTIPLY;
                    this._meshes[m].filters = [multiplyFilter];
                }else{
                    this._meshes[m].blendMode = PIXI.BLEND_MODES.MULTIPLY;
                }
            }


            // Attach mesh to self.
            this.addChild(this._meshes[m]);
        };

        // Setup mask sprites.
        this._maskSpriteContainer = new MaskSpriteContainer(coreModel, this);
    }

    /** [[true]] if instance is valid; [[false]] otherwise. */
    private get isValid(): boolean {
        return this._coreModel != null;
    }
}

/** PIXI Cubism mask Container. */
export class MaskSpriteContainer extends PIXI.Container{

    /** Rendarable mask sprites. */
    public get maskSprites(): Array<PIXI.Sprite>{
        return this._maskSprites;
    }
    /** Off screen rendarable mask meshes. */
    public get maskMeshes(): Array<PIXI.Container>{
        return this._maskMeshContainers;
    }

    // Instance references.
    private _maskSprites: Array<PIXI.Sprite>;
    private _maskMeshContainers: Array<PIXI.Container>;
    private _maskTextures: Array<PIXI.RenderTexture>;
    private _maskShader: PIXI.Filter<{}>;

    /** Destroys objects. */
    public destroy(options?: any): void {

        this._maskSprites.forEach((m) => {
            m.destroy();
        });

        this._maskTextures.forEach((m) => {
            m.destroy();
        });

        this._maskMeshContainers.forEach((m) => {
            m.destroy();
        });

        this._maskShader = null;
    }

    /**
     * Creates masky sprite instances.
     * @param coreModel Core Model.
     * @param pixiModel PixiJS Model.
     */
    public constructor(coreModel: Live2DCubismCore.Model, pixiModel: LIVE2DCUBISMPIXI.Model){
        // Initialize base class.
        super();

        // Masky shader for render the texture that attach to mask sprite.
        this._maskShader = new PIXI.Filter(this._maskShaderVertSrc.toString(), this._maskShaderFragSrc.toString());

        let _maskCounts = coreModel.drawables.maskCounts;
        let _maskRelationList = coreModel.drawables.masks;

        this._maskMeshContainers = new Array<PIXI.Container>();
        this._maskTextures = new Array<PIXI.RenderTexture>();
        this._maskSprites = new Array<PIXI.Sprite>();

        for(let m=0; m < pixiModel.meshes.length; ++m){
            if(_maskCounts[m] > 0){

                let newContainer = new PIXI.Container;

                for(let n = 0; n < _maskRelationList[m].length; ++n){
                    let meshMaskID = coreModel.drawables.masks[m][n];
                    let maskMesh = new CubismMesh(
                        pixiModel.meshes[meshMaskID].texture,
                        pixiModel.meshes[meshMaskID].vertices,
                        pixiModel.meshes[meshMaskID].uvs,
                        pixiModel.meshes[meshMaskID].indices,
                        PIXI.DRAW_MODES.TRIANGLES
                    );
                    maskMesh.name = pixiModel.meshes[meshMaskID].name;

                    // Synchronize transform with visible mesh.
                    maskMesh.transform = pixiModel.meshes[meshMaskID].transform;
                    maskMesh.worldTransform = pixiModel.meshes[meshMaskID].worldTransform;
                    maskMesh.localTransform = pixiModel.meshes[meshMaskID].localTransform;

                    maskMesh.isCulling = pixiModel.meshes[meshMaskID].isCulling;
                    maskMesh.isMaskMesh = true;

                    maskMesh.filters = [this._maskShader];

                    newContainer.addChild(maskMesh);

                }

                // Synchronize transform with visible model.
                newContainer.transform = pixiModel.transform;
                newContainer.worldTransform = pixiModel.worldTransform;
                newContainer.localTransform = pixiModel.localTransform;
                this._maskMeshContainers.push(newContainer);

                // Create RenderTexture instance.
                let newTexture = PIXI.RenderTexture.create(0, 0);
                this._maskTextures.push(newTexture);

                // Create mask sprite instance.
                let newSprite = new PIXI.Sprite(newTexture);
                this._maskSprites.push(newSprite);
                this.addChild(newSprite);

                pixiModel.meshes[m].mask = newSprite;

            }
        }
    }

    /** Update render textures for mask sprites */
    public update (appRenderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer){
        for (let m = 0; m < this._maskSprites.length; ++m){
            appRenderer.render(this._maskMeshContainers[m], this._maskTextures[m], true, null, false);
        }
    }

    /** Resize render textures size */
    public resize(viewWidth: number, viewHeight: number){
        for (let m = 0; m < this._maskTextures.length; ++m){
            this._maskTextures[m].resize(viewWidth, viewHeight, false);
        }
    }

    /** Vertex Shader apply for masky mesh */
    private _maskShaderVertSrc = new String(
        `
            attribute vec2 aVertexPosition;
            attribute vec2 aTextureCoord;
            uniform mat3 projectionMatrix;
            varying vec2 vTextureCoord;
            void main(void){
                gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
                vTextureCoord = aTextureCoord;
            }
            `
    );

    /** Fragment Shader apply for masky mesh
     *  In PixiJS, it seems that the mask range uses the value of masky's Red channel,
     *  this shader to be change the value of the Red channel, regardless of the color of the mesh texture.
     *  https://github.com/pixijs/pixi.js/blob/master/src/core/renderers/webgl/filters/spriteMask/spriteMaskFilter.frag
     */
    private _maskShaderFragSrc = new String(
        `
            varying vec2 vTextureCoord;
            uniform sampler2D uSampler;
            void main(void){
                vec4 c = texture2D(uSampler, vTextureCoord);
                c.r = c.a;
                c.g = 0.0;
                c.b = 0.0;
                gl_FragColor = c;
            }
            `
    );

}

/** PIXI Cubism [[Model]] builder. */
export class ModelBuilder {
    /**
     * Sets moc.
     */
    constructor(mocBuffer: ArrayBuffer) {
        this._moc = Live2DCubismCore.Moc.fromArrayBuffer(mocBuffer);
    }

    /**
     * Sets animator time scale.
     *
     * @param value Time scale.
     *
     * @return Builder.
     */
    public setTimeScale(value: number): ModelBuilder {
        this._timeScale = value;


        return this;
    }

    /**
     * Sets physics JSON file.
     *
     * @param value Physics JSON file.
     *
     * @return Builder.
     */
    public setPhysics3Json(value: any): ModelBuilder {
        if (!this._physicsRigBuilder) {
            this._physicsRigBuilder = new L2DFrameWork.PhysicsRigBuilder();
        }
        this._physicsRigBuilder.setPhysics3Json(value);


        return this;
    }

    /**
     *
     * Sets UserData JSON file.
     *
     * @param value UserData JSON file.
     *
     * @return Builder.
     *
     */
    public setUserData3Json(value: any): ModelBuilder {
        if(!this._userDataBuilder){
            this._userDataBuilder = new L2DFrameWork.UserDataBuilder();
        }
        this._userDataBuilder.setUserData3Json(value);


        return this;
    }

    /**
     * Adds texture.
     *
     * @param index Texture index.
     * @param texture Texture.
     *
     * @return Builder.
     */
    public addTexture(index: number, texture: PIXI.Texture): ModelBuilder {
        this._textures.splice(index, 0, texture);


        return this;
    }

    /**
     * Adds animator layer.
     *
     * @param name Name.
     * @param blender Blender.
     * @param weight Weight.
     *
     * @return Builder.
     */
    public addAnimatorLayer(name: string, blender: L2DFrameWork.IAnimationBlender = L2DFrameWork.BuiltinAnimationBlenders.OVERRIDE, weight: number = 1) {
        this._animatorBuilder.addLayer(name, blender, weight);


        return this;
    }

    /**
     * Adds group objects from `Groups` tag in model3.json.
     *
     * @param groups
     */
    public addGroups(groups: L2DFrameWork.Groups): ModelBuilder {
        this._groups = groups;

        return this;
    }

    /**
     *
     * Build Cubism Model from model3.json file.
     *
     * @param loader
     * @param resources
     * @param callbackFunc
     */
    public buildFromModel3Json(loader: PIXI.loaders.Loader, model3Obj: PIXI.loaders.Resource, callbackFunc:(model: LIVE2DCUBISMPIXI.Model) => any): void {

        var model3URL = model3Obj.url;
        var modelDir = model3URL.substring( 0, model3URL.lastIndexOf( "/" ) + 1);
        let textureCount = 0;

        // Check JSON tag defined/undefined.
        if(typeof(model3Obj.data['FileReferences']['Moc']) !== "undefined")
            loader.add('moc', modelDir + model3Obj.data['FileReferences']['Moc'], { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER })

        if(typeof(model3Obj.data['FileReferences']['Textures']) !== "undefined") {
            model3Obj.data['FileReferences']['Textures'].forEach((element: any) => {
                loader.add('texture' + textureCount, modelDir + element);
                textureCount++;
            });
        }

        if(typeof(model3Obj.data['FileReferences']['Physics']) !== "undefined")
            loader.add('physics', modelDir + model3Obj.data['FileReferences']['Physics'], { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })

        if(typeof(model3Obj.data['FileReferences']['UserData']) !== "undefined")
            loader.add('userdata', modelDir + model3Obj.data['FileReferences']['UserData'], { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON })

        if(typeof(model3Obj.data['Groups'] !== "undefined"))
            this._groups = L2DFrameWork.Groups.fromModel3Json(model3Obj.data);

        // Load assets and build pixi model.
        loader.load((loader: PIXI.loaders.Loader, resources: PIXI.loaders.ResourceDictionary) => {

            if(typeof(resources['moc']) !== "undefined")
                this.setMoc(Live2DCubismCore.Moc.fromArrayBuffer(resources['moc'].data));

            if(typeof(resources['texture' + 0]) !== "undefined"){
                for(let i = 0; i < textureCount; i++)
                    this.addTexture(i, resources['texture' + i].texture);
            }

            if(typeof(resources['physics']) !== "undefined")
                this.setPhysics3Json(resources['physics'].data);

            if(typeof(resources['userdata']) !== "undefined")
                this.setUserData3Json(resources['userdata'].data);

            let model = this.build();

            callbackFunc(model);

        });

    }


    /**
     * Executes build.
     *
     * @return Model.
     */
    public build(): Model {
        // TODO Validate state.


        // Create core.
        let coreModel = Live2DCubismCore.Model.fromMoc(this._moc);


        if (coreModel == null) {
            return null;
        }


        // Create animator.
        let animator = this._animatorBuilder
            .setTarget(coreModel)
            .setTimeScale(this._timeScale)
            .build();


        // Create physics rig if JSON available.
        let physicsRig: L2DFrameWork.PhysicsRig = null;


        if (this._physicsRigBuilder) {
            physicsRig = this._physicsRigBuilder
                .setTarget(coreModel)
                .setTimeScale(this._timeScale)
                .build();
        }


        //Create user data if JSON available.
        let userData: L2DFrameWork.UserData = null;

        if(this._userDataBuilder){
            userData = this._userDataBuilder
                .setTarget(coreModel)
                .build();
        }

        // Create model.
        return Model._create(coreModel, this._textures, animator, physicsRig, userData, this._groups);
    }


    /** Moc. */
    private _moc: Live2DCubismCore.Moc;
    /** Textures. */
    private _textures: Array<PIXI.Texture> = new Array<PIXI.Texture>();
    /** Time scale. */
    private _timeScale: number = 1;
    /** Animator builder. */
    private _animatorBuilder: L2DFrameWork.AnimatorBuilder = new L2DFrameWork.AnimatorBuilder();
    /** Physics rig builder. */
    private _physicsRigBuilder: L2DFrameWork.PhysicsRigBuilder;
    /** UserData builder. */
    private _userDataBuilder: L2DFrameWork.UserDataBuilder;

    private _groups: L2DFrameWork.Groups;
}

/**
 *  PIXI Cubism [[CubismMesh]] inherited by PIXI.mesh.Mesh
 *  CubismMesh is customizable mesh class for having the same properties as ArtMesh.
 */
export class CubismMesh extends PIXI.mesh.Mesh {

    protected _renderWebGL(renderer: PIXI.WebGLRenderer): void {

        // FIXME: On rendered mask mesh's face is inverse by rendered mesh.
        if(this.isMaskMesh === true)
            renderer.state.setFrontFace(1); // CW
        else
            renderer.state.setFrontFace(0); // CCW ...default

        if(this.isCulling === true)
            renderer.state.setCullFace(1); // CULL_FACE = true;
        else
            renderer.state.setCullFace(0); // CULL_FACE = false;

        // Render this.
        super._renderWebGL(renderer);

        // FIXME: Inversed mask mesh's face must re-inverse.
        renderer.state.setFrontFace(0);

    }

    /** Enable/Disable back-face culling  */
    public isCulling : boolean = false;

    /** Flag for mesh for masking */
    public isMaskMesh : boolean = false;
}

