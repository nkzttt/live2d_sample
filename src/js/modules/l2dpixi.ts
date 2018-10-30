import * as PIXI from 'pixi.js';
import * as L2DFrameWork from './l2dframework';

/**
 * PIXI Cubism [[Model]] builder
 */
export class ModelBuilder {
    private _moc: Live2DCubismCore.Moc | null;
    private _setTimeScale: number;
    private _textures: Array<PIXI.Texture>;
    private _animatorLayers: Array<{
        name: string,
        blender: L2DFrameWork.animation.IAnimationBlender,
        weight: number
    }>;

    constructor() {
        this._moc = null;
        this._setTimeScale = 1;
        this._textures = [];
        this._animatorLayers = [];
    }

    public setMoc(mocBuffer: ArrayBuffer) {
        this._moc = Live2DCubismCore.Moc.fromArrayBuffer(mocBuffer);
    }

    public setTimeScale(value: number): void {
        this._setTimeScale = value;
    }

    public addTexture(index: number, texture: PIXI.Texture): void {
        this._textures.splice(index, 0, texture);
    }

    public addAnimatorLayer(
        {
            name,
            blender = L2DFrameWork.animation.BuiltinAnimationBlenders.OVERRIDE,
            weight = 1
        }: {
            name: string,
            blender?: L2DFrameWork.animation.IAnimationBlender,
            weight?: number
        }
    ): void {
        this._animatorLayers.push({name, blender, weight});
    }

    public build(): Model | void {
        // validate
        let hasError = false;
        if (this._moc === null) {
            console.warn('moc is not set...');
            hasError = true;
        }
        if (this._textures.length === 0) {
            console.warn('no textures has added...');
            hasError = true;
        }
        if (this._animatorLayers.length === 0) {
            console.warn('no animatorLayers has added...');
            hasError = true;
        }
        if (hasError) return;

        // create core model
        const moc = this._moc as Live2DCubismCore.Moc;
        const coreModel = Live2DCubismCore.Model.fromMoc(moc);

        // create animator
        const animatorBuilder = new L2DFrameWork.animation.AnimatorBuilder();
        animatorBuilder.setTarget(coreModel);
        animatorBuilder.setTimeScale(this._setTimeScale);
        this._animatorLayers.forEach((
            {
                name,
                blender,
                weight
            }: {
                name: string,
                blender: L2DFrameWork.animation.IAnimationBlender,
                weight: number
            }
        ) => {
            animatorBuilder.addLayer(name, blender, weight);
        });
        const animator = animatorBuilder.build() as L2DFrameWork.animation.Animator;

        // Create model.
        return new Model(coreModel, this._textures, animator);
    }
}

/**
 * PIXI Cubism model wrapper
 */
export class Model extends PIXI.Container {
    private _coreModel: Live2DCubismCore.Model;
    private _textures: Array<PIXI.Texture>;
    private _animator: L2DFrameWork.animation.Animator;
    private _animations: Array<L2DFrameWork.animation.Animation>;
    private _meshes: Array<CubismMesh>;
    private _maskSpriteContainer: MaskSpriteContainer;

    get coreModel(): Live2DCubismCore.Model {
        return this._coreModel;
    }

    get textures(): Array<PIXI.Texture> {
        return this._textures;
    }

    get animator(): L2DFrameWork.animation.Animator {
        return this._animator;
    }

    get meshes(): Array<CubismMesh> {
        return this._meshes;
    }

    get masks(): MaskSpriteContainer {
        return this._maskSpriteContainer;
    }

    constructor(coreModel: Live2DCubismCore.Model, textures: Array<PIXI.Texture>, animator: L2DFrameWork.animation.Animator) {
        super();

        this._coreModel = coreModel;
        this._textures = textures;
        this._animator = animator;
        this._animations = [];

        // Create meshes.
        this._meshes = [];
        for (let m = 0; m < this._coreModel.drawables.ids.length; ++m) {
            // Patch uvs.
            let uvs = this._coreModel.drawables.vertexUvs[m].slice(0, this._coreModel.drawables.vertexUvs[m].length);

            for (let v = 1; v < uvs.length; v += 2) {
                uvs[v] = 1 - uvs[v];
            }

            // Create mesh.
            const mesh = new CubismMesh(
                textures[this._coreModel.drawables.textureIndices[m]],
                this._coreModel.drawables.vertexPositions[m],
                uvs,
                this._coreModel.drawables.indices[m],
                PIXI.DRAW_MODES.TRIANGLES
            );

            // Set mesh name by cubism drawables ID.
            mesh.name = this._coreModel.drawables.ids[m];
            // HACK Flip mesh...
            mesh.scale.y *= -1;
            // Set culling flag.
            mesh.isCulling = !Live2DCubismCore.Utils.hasIsDoubleSidedBit(this._coreModel.drawables.constantFlags[m]);

            if (Live2DCubismCore.Utils.hasBlendAdditiveBit(this._coreModel.drawables.constantFlags[m])) {
                // Masked mesh is disabled additive blending mode.
                // https://github.com/pixijs/pixi.js/issues/3824
                if (this._coreModel.drawables.maskCounts[m] > 0) {
                    const addFilter = new PIXI.Filter();
                    addFilter.blendMode = PIXI.BLEND_MODES.ADD;
                    mesh.filters = [addFilter];
                } else {
                    mesh.blendMode = PIXI.BLEND_MODES.ADD;
                }
            }
            else if (Live2DCubismCore.Utils.hasBlendMultiplicativeBit(this._coreModel.drawables.constantFlags[m])) {
                // Masked mesh is disabled multiply blending mode.
                // https://github.com/pixijs/pixi.js/issues/3824
                if (this._coreModel.drawables.maskCounts[m] > 0) {
                    const multiplyFilter = new PIXI.Filter();
                    multiplyFilter.blendMode = PIXI.BLEND_MODES.MULTIPLY;
                    mesh.filters = [multiplyFilter];
                } else {
                    mesh.blendMode = PIXI.BLEND_MODES.MULTIPLY;
                }
            }

            // Attach mesh to self.
            this.addChild(mesh);

            this._meshes.push(mesh);
        }

        // Setup mask sprites.
        this._maskSpriteContainer = new MaskSpriteContainer(this);
    }

    public addAnimation(index: number, data: object): void {
        const animation = new L2DFrameWork.animation.Animation(data);
        this._animations.splice(index, 0, animation);
    }

    public playAnimation(name: string, index: number): void {
        const animatorLayer = this.animator.getLayer(name);
        if (!animatorLayer) {
            console.warn('missing animation layer...');
            return;
        }

        animatorLayer.play(this._animations[index]);
    }

    public update(delta: number): void {
        // Patch delta time (as Pixi's delta references performance?)
        let deltaTime = 0.016 * delta;

        // Update components.
        this._animator.updateAndEvaluate(deltaTime);

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
        this._meshes.forEach(mesh => mesh.destroy());

        // Optionally destroy textures.
        if (options == true || options.texture) {
            this._textures.forEach(texture => texture.destroy());
        }
    }

    public getModelMeshById(id: string): CubismMesh | void {
        return this._meshes.find(mesh => mesh.name === id);
    }
}

/**
 *  PIXI Cubism [[CubismMesh]] inherited by PIXI.mesh.Mesh
 *  CubismMesh is customizable mesh class for having the same properties as ArtMesh.
 */
export class CubismMesh extends PIXI.mesh.Mesh {

    protected _renderWebGL(renderer: PIXI.WebGLRenderer): void {
        if (!renderer.state) {
            return super._renderWebGL(renderer);
        }

        // FIXME: On rendered mask mesh's face is inverse by rendered mesh.
        if (this.isMaskMesh === true)
            renderer.state.setFrontFace(1); // CW
        else
            renderer.state.setFrontFace(0); // CCW ...default

        if (this.isCulling === true)
            renderer.state.setCullFace(1); // CULL_FACE = true;
        else
            renderer.state.setCullFace(0); // CULL_FACE = false;

        // Render this.
        super._renderWebGL(renderer);

        // FIXME: Inversed mask mesh's face must re-inverse.
        renderer.state.setFrontFace(0);

    }

    /** Enable/Disable back-face culling  */
    public isCulling: boolean = false;

    /** Flag for mesh for masking */
    public isMaskMesh: boolean = false;
}

/**
 * PIXI Cubism mask Container
 */
export class MaskSpriteContainer extends PIXI.Container {
    private _maskSprites: Array<PIXI.Sprite>;
    private _maskMeshContainers: Array<PIXI.Container>;
    private _maskTextures: Array<PIXI.RenderTexture>;
    private _maskShader: PIXI.Filter<{}>;

    get maskSprites(): Array<PIXI.Sprite> {
        return this._maskSprites;
    }

    get maskMeshes(): Array<PIXI.Container> {
        return this._maskMeshContainers;
    }

    public constructor(model: Model) {
        super();

        // Masky shader for render the texture that attach to mask sprite.
        this._maskShader = new PIXI.Filter(this._maskShaderVertSrc.toString(), this._maskShaderFragSrc.toString());

        let _maskCounts = model.coreModel.drawables.maskCounts;
        let _maskRelationList = model.coreModel.drawables.masks;

        this._maskMeshContainers = [];
        this._maskTextures = [];
        this._maskSprites = [];

        for (let m = 0; m < model.meshes.length; ++m) {
            if (_maskCounts[m] > 0) {

                let newContainer = new PIXI.Container();

                for (let n = 0; n < _maskRelationList[m].length; ++n) {
                    let meshMaskID = model.coreModel.drawables.masks[m][n];
                    let maskMesh = new CubismMesh(
                        model.meshes[meshMaskID].texture,
                        model.meshes[meshMaskID].vertices,
                        model.meshes[meshMaskID].uvs,
                        model.meshes[meshMaskID].indices,
                        PIXI.DRAW_MODES.TRIANGLES
                    );
                    maskMesh.name = model.meshes[meshMaskID].name;

                    // Synchronize transform with visible mesh.
                    maskMesh.transform = model.meshes[meshMaskID].transform;
                    maskMesh.worldTransform = model.meshes[meshMaskID].worldTransform;
                    maskMesh.localTransform = model.meshes[meshMaskID].localTransform;

                    maskMesh.isCulling = model.meshes[meshMaskID].isCulling;
                    maskMesh.isMaskMesh = true;

                    maskMesh.filters = [this._maskShader];

                    newContainer.addChild(maskMesh);

                }

                // Synchronize transform with visible model.
                newContainer.transform = model.transform;
                newContainer.worldTransform = model.worldTransform;
                newContainer.localTransform = model.localTransform;
                this._maskMeshContainers.push(newContainer);

                // Create RenderTexture instance.
                let newTexture = PIXI.RenderTexture.create(0, 0);
                this._maskTextures.push(newTexture);

                // Create mask sprite instance.
                let newSprite = new PIXI.Sprite(newTexture);
                this._maskSprites.push(newSprite);
                this.addChild(newSprite);

                model.meshes[m].mask = newSprite;

            }
        }
    }

    /** Destroys objects. */
    public destroy(options?: any): void {
        this._maskSprites.forEach(sprite => sprite.destroy());
        this._maskTextures.forEach(texture => texture.destroy());
        this._maskMeshContainers.forEach(container => container.destroy());
        this._maskShader = new PIXI.Filter();
    }

    /** Update render textures for mask sprites */
    public update(appRenderer: PIXI.WebGLRenderer | PIXI.CanvasRenderer) {
        for (let m = 0; m < this._maskSprites.length; ++m) {
            appRenderer.render(this._maskMeshContainers[m], this._maskTextures[m], true, undefined, false);
        }
    }

    /** Resize render textures size */
    public resize(viewWidth: number, viewHeight: number) {
        for (let m = 0; m < this._maskTextures.length; ++m) {
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
