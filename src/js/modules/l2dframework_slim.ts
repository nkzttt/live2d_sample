//#region  Animator section.

/** Cubism animation point. */
export class AnimationPoint {
    /**
     * Initializes point.
     *
     * @param time Timing.
     * @param value Value at time.
     */
    public constructor(public time: number, public value: number) {}
}

/** Unit of animation user data. */
export class AnimationUserDataBody{

    /**
     *
     * @param time
     * @param value
     */
    public constructor (public time: number, public value: string) {};
}

/** Cubism animation segment evaluator. */
export interface IAnimationSegmentEvaluator {
    /**
     * Evaluates segment.
     *
     * @param points Points.
     * @param offset Offset into points.
     * @param time Time to evaluate at.
     *
     * @return Evaluation result.
     */
    (points: Array<AnimationPoint>, offset: number, time: number): number;
}


/** Builtin Cubism animation segment evaluators. */
export class BuiltinAnimationSegmentEvaluators {
    /**
     * Linear segment evaluator.
     *
     * @param points Points.
     * @param offset Offset into points.
     * @param time Time to evaluate at.
     *
     * @return Evaluation result.
     */
    public static LINEAR: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        let p0 = points[offset + 0];
        let p1 = points[offset + 1];
        let t = (time - p0.time) / (p1.time - p0.time);


        return (p0.value + ((p1.value - p0.value) * t));
    }

    /**
     * Bézier segment evaluator.
     *
     * @param points Points.
     * @param offset Offset into points.
     * @param time Time to evaluate at.
     *
     * @return Evaluation result.
     */
    public static BEZIER: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        let t = (time - points[offset + 0].time) / (points[offset + 3].time - points[offset].time);


        let p01 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 0], points[offset + 1], t);
        let p12 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 1], points[offset + 2], t);
        let p23 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 2], points[offset + 3], t);

        let p012 = BuiltinAnimationSegmentEvaluators.lerp(p01, p12, t);
        let p123 = BuiltinAnimationSegmentEvaluators.lerp(p12, p23, t);


        return BuiltinAnimationSegmentEvaluators.lerp(p012, p123, t).value;
    }

    /**
     * Stepped segment evaluator.
     *
     * @param points Points.
     * @param offset Offset into points.
     * @param time Time to evaluate at.
     *
     * @return Evaluationr result.
     */
    public static STEPPED: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        return points[offset + 0].value;
    }

    /**
     * Inverse-stepped segment evaluator.
     *
     * @param points Points.
     * @param offset Offset into points.
     * @param time Time to evaluate at.
     *
     * @return Evaluationr result.
     */
    public static INVERSE_STEPPED: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        return points[offset + 1].value;
    }


    /**
     * Interpolates points.
     *
     * @param a First point.
     * @param b Second point.
     * @param t Weight.
     *
     * @return Interpolation result.
     */
    private static lerp(a: AnimationPoint, b: AnimationPoint, t: number): AnimationPoint {

        return new AnimationPoint((a.time + ((b.time - a.time) * t)), (a.value + ((b.value - a.value) * t)));
    }
}


/** Cubism animation track segment. */
export class AnimationSegment {
    /**
     * Initializes instance.
     *
     * @param offset Offset into points.
     * @param evaluate Evaluator.
     */
    public constructor(public offset: number, public evaluate: IAnimationSegmentEvaluator) {}
}


/** Cubism animation track. */
export class AnimationTrack {
    /**
     * Initializes instance.
     *
     * @param targetId Target ID.
     * @param points Points.
     * @param segments Segments.
     */
    public constructor(public targetId: string, public points: Array<AnimationPoint>, public segments: Array<AnimationSegment>) {}


    /**
     * Evaluates track
     *
     * @param time Time to evaluate at.
     *
     * @return Evaluation result.
     */
    public evaluate(time: number): number {
        // Find segment to evaluate.
        let s = 0;
        let lastS = this.segments.length - 1;


        for(; s < lastS; ++s) {
            if (this.points[this.segments[s + 1].offset].time < time) {
                continue;
            }


            break;
        }


        // Evaluate segment.
        // TODO Passing segment offset somewhat to itself is awkward. Improve it?
        return this.segments[s].evaluate(this.points, this.segments[s].offset, time);
    }
}


/** Cubism animation. */
export class Animation {
    /**
     * Deserializes animation from motion3.json.
     *
     * @param motion3Json Parsed motion3.json
     *
     * @return Animation on success; 'null' otherwise.
     */
    public static fromMotion3Json(motion3Json: any): Animation {
        if (motion3Json == null) {
            return null;
        }


        let animation = new Animation(motion3Json);


        return (animation.isValid)
            ? animation
            : null;
    }

    /**
     * Register a callback function.
     *
     * @param callbackFunc function: (arg: string) => void
     */
    public addAnimationCallback(callbackFunc: (arg: string) => void): void {
        if(this._callbackFunctions == null)
            this._callbackFunctions = new Array<(arg: string) => void>();

        this._callbackFunctions.push(callbackFunc);
    }

    /**
     * Remove a particular callback function.
     *
     * @param callbackFunc
     */
    public removeAnimationCallback(callbackFunc: (arg: string) => void): void {
        if(this._callbackFunctions != null){
            let _target = -1;
            for(let _index=0; _index < this._callbackFunctions.length; _index++) {
                if(this._callbackFunctions[_index] === callbackFunc){
                    _target = _index;
                    break;
                }
            }

            if(_target >= 0)
                this._callbackFunctions.splice(_target, 1);
        }
    }

    /**
     * Clear registered callback functions.
     */
    public clearAnimationCallback(): void{
        this._callbackFunctions = [];
    }

    /**
     * Execute callback functions.
     *
     * @param value
     */
    private callAnimationCallback(value: string): void {
        if(this._callbackFunctions.length > 0)
            this._callbackFunctions.forEach((func: (arg: string) => void) => { func(value); });
    }


    /** Duration (in seconds). */
    public duration: number;

    /** Fps. */
    public fps: number;

    /** Loop control. */
    public loop: boolean;

    /** Number of user data. */
    public userDataCount: number;

    /** Total number of user data size */
    public totalUserDataSize: number;

    /** Model tracks. */
    public modelTracks: Array<AnimationTrack> = new Array<AnimationTrack>();

    /** Parameter tracks. */
    public parameterTracks: Array<AnimationTrack> = new Array<AnimationTrack>();

    /** Part opacity tracks. */
    public partOpacityTracks: Array<AnimationTrack> = new Array<AnimationTrack>();

    /** Array of animation user data body. */
    public userDataBodys: Array<AnimationUserDataBody> = new Array<AnimationUserDataBody>();

    /** Callback Functions/ */
    private _callbackFunctions: Array<(arg: string) => void>;

    /** Compare for check event. */
    private _lastTime: number;

    /**
     * Evaluates animation.
     *
     * @param time Time.
     * @param weight Weight.
     * @param blend Blender.
     * @param target Target.
     */
    public evaluate(time: number, weight: number, blend: IAnimationBlender,
                    target: Live2DCubismCore.Model, stackFlags:any, groups: Groups = null): void {
        // Return early if influence is miminal.
        if (weight <= 0.01) {
            return;
        }


        // Loop animation time if requested.
        if (this.loop) {
            while (time > this.duration) {
                time -= this.duration;
            }
        }


        // Evaluate tracks and apply results.
        this.parameterTracks.forEach((t) => {
            let p = target.parameters.ids.indexOf(t.targetId);


            if (p >= 0) {
                let sample = t.evaluate(time);

                if(stackFlags[0][p] != true) {
                    target.parameters.values[p] = target.parameters.defaultValues[p];
                    stackFlags[0][p] = true;
                }

                target.parameters.values[p] = blend(target.parameters.values[p], sample, t.evaluate(0), weight);
            }
        });


        this.partOpacityTracks.forEach((t) => {
            let p = target.parts.ids.indexOf(t.targetId);


            if (p >= 0) {
                let sample = t.evaluate(time);

                if(stackFlags[1][p] != true) {
                    target.parts.opacities[p] = 1;
                    stackFlags[1][p] = true;
                }

                target.parts.opacities[p] = blend(target.parts.opacities[p], sample, t.evaluate(0), weight);
            }
        });


        // Evaluate model tracks.
        this.modelTracks.forEach((t) => {
            if(groups != null) {
                let g = groups.getGroupById(t.targetId);

                if(g != null && g.target === "Parameter") {
                    for(let tid of g.ids) {
                        let p = target.parameters.ids.indexOf(tid);

                        if (p >= 0) {
                            let sample = t.evaluate(time);

                            if(stackFlags[0][p] != true) {
                                target.parameters.values[p] = target.parameters.defaultValues[p];
                                stackFlags[0][p] = true;
                            }

                            target.parameters.values[p] = blend(target.parameters.values[p], sample, t.evaluate(0), weight);
                        }
                    }
                }
            }
        });

        // Check user data event.
        if(this._callbackFunctions != null){
            for(let ud of this.userDataBodys) {
                if(this.isEventTriggered(<number>ud.time, time, this._lastTime, this.duration))
                    this.callAnimationCallback(ud.value);
            }
        }

        this._lastTime = time;
    }

    /** 'true' if user data's time value is inside of range. */
    private isEventTriggered(timeEvaluate: number, timeForward: number, timeBack: number, duration: number): boolean {
        if(timeForward > timeBack){
            if(timeEvaluate > timeBack && timeEvaluate < timeForward)
                return true;
        }
        else{
            if(timeEvaluate > 0 && timeEvaluate < timeForward
                || timeEvaluate > timeBack && timeEvaluate < duration)
                return true;
        }
        return false;
    }

    /** 'true' if instance is valid; 'false' otherwise. */
    private get isValid(): boolean {
        return true;
    }


    /**
     * Creates instance.
     *
     * @param motion3Json Parsed motion3.json.
     */
    private constructor(motion3Json: any) {
        // Deserialize meta.
        this.duration = motion3Json['Meta']['Duration'];
        this.fps = motion3Json['Meta']['Fps'];
        this.loop = motion3Json['Meta']['Loop'];
        this.userDataCount = motion3Json['Meta']['UserDataCount'];
        this.totalUserDataSize = motion3Json['Meta']['TotalUserDataSize'];

        // Deserialize user data.
        if(motion3Json['UserData'] != null){
            motion3Json['UserData'].forEach((u: any) => {
                // Deserialize animation user data body.
                this.userDataBodys.push(new AnimationUserDataBody(u['Time'], u['Value']));
            });
            console.assert(this.userDataBodys.length === this.userDataCount);
        }


        // Deserialize tracks.
        motion3Json['Curves'].forEach((c: any) => {
            // Deserialize segments.
            let s = c['Segments'];


            let points = new Array<AnimationPoint>();
            let segments = new Array<AnimationSegment>();


            points.push(new AnimationPoint(s[0], s[1]));


            for (var t = 2; t < s.length; t += 3) {
                let offset = points.length - 1;
                let evaluate = BuiltinAnimationSegmentEvaluators.LINEAR;


                // Handle segment types.
                let type = s[t];

                if (type == 1) {
                    evaluate = BuiltinAnimationSegmentEvaluators.BEZIER;


                    points.push(new AnimationPoint(s[t + 1], s[t + 2]));
                    points.push(new AnimationPoint(s[t + 3], s[t + 4]));


                    t += 4;
                }
                else if (type == 2) {
                    evaluate = BuiltinAnimationSegmentEvaluators.STEPPED;
                }
                else if (type == 3) {
                    evaluate = BuiltinAnimationSegmentEvaluators.INVERSE_STEPPED;
                }
                else if (type != 0) {
                    // TODO Handle unexpected segment type.
                }


                // Push segment and point.
                points.push(new AnimationPoint(s[t + 1], s[t + 2]));
                segments.push(new AnimationSegment(offset, evaluate));
            }


            // Create track.
            let track = new AnimationTrack(c['Id'], points, segments);


            // Push track.
            if (c['Target'] == 'Model') {
                this.modelTracks.push(track);
            }
            else if (c['Target'] == 'Parameter') {
                this.parameterTracks.push(track);
            }
            else if (c['Target'] == 'PartOpacity') {
                this.partOpacityTracks.push(track);
            }
            else {
                // TODO Handle unexpected target.
            }
        });
    }
}


/** Cubism animation cross-fade weighter. */
export interface IAnimationCrossfadeWeighter {
    /**
     * Weights crossfade.
     *
     * @param time Current fade time.
     * @param duration Total fade duration.
     *
     * @return Normalized source weight. (Destination will be weight as (1 - source weight)).
     */
    (time: number, duration: number): number;
}


/** Builtin Cubims crossfade  */
export class BuiltinCrossfadeWeighters {
    /**
     * Linear crossfade weighter.
     *
     * @param time Current fade time.
     * @param duration Total fade duration.
     *
     * @return Normalized source weight. (Destination will be weight as (1 - source weight)).
     */
    public static LINEAR(time: number, duration: number): number {
        return (time / duration);
    }
}


/** Cubism animation state. */
export class AnimationState {
    /** Time. */
    public time: number;
}


/** Cubism animation layer blender. */
export interface IAnimationBlender {
    /**
     * Blends.
     *
     * @param source Source value.
     * @param destination Destination value.
     * @param weight Weight.
     *
     * @return Blend result.
     */
    (source: number, destination: number, initial: number, weight: number): number;
}


/** Builtin Cubism animation layer blenders. */
export class BuiltinAnimationBlenders {
    /**
     * Override blender.
     *
     * @param source Source value.
     * @param destination Destination value.
     * @param weight Weight.
     *
     * @return Blend result.
     */
    public static OVERRIDE: IAnimationBlender = function(source: number, destination: number, initial: number, weight: number): number {
        return ((destination * weight) + source * (1 - weight));
    }

    /**
     * Additive blender.
     *
     * @param source Source value.
     * @param destination Destination value.
     * @param weight Weight.
     *
     * @return Blend result.
     */
    public static ADD: IAnimationBlender = function(source: number, destination: number, initial: number, weight: number): number {
        return (source + ((destination - initial) * weight));
    }

    /**
     * Multiplicative blender.
     *
     * @param source Source value.
     * @param destination Destination value.
     * @param weight Weight.
     *
     * @return Blend result.
     */
    public static MULTIPLY: IAnimationBlender = function(source: number, destination: number, weight: number): number {
        return (source * (1 + ((destination - 1) * weight)));
    }
}


/** Cubism animation layer. */
export class AnimationLayer {
    /** Current animation. */
    public get currentAnimation(): Animation {
        return this._animation;
    }

    /** Current time. */
    public get currentTime(): number {
        return this._time;
    }
    public set currentTime(value: number) {
        this._time = value;
    }

    /** Blender. */
    public blend: IAnimationBlender;

    /** Crossfade weighter. */
    public weightCrossfade: IAnimationCrossfadeWeighter;

    /** Normalized weight. */
    public weight: number = 1;

    /** Parameter groups [optional]. */
    public groups: Groups;

    /** 'true' if layer is playing; 'false' otherwise. */
    public get isPlaying(): boolean {
        return this._play;
    }


    /**
     * Starts playing animation.
     *
     * @param animation Animation to play.
     */
    public play(animation: Animation, fadeDuration: number = 0): void {
        if (this._animation && fadeDuration > 0) {
            this._goalAnimation = animation;
            this._goalTime = 0;

            this._fadeTime = 0;
            this._fadeDuration = fadeDuration;
        }
        else {
            this._animation = animation;
            this.currentTime = 0;
            this._play = true;
        }
    }

    /** Resumes playback. */
    public resume(): void {
        this._play = true;
    }

    /** Pauses playback (preserving time). */
    public pause(): void {
        this._play = false;
    }

    /** Stops playback (resetting time). */
    public stop(): void {
        this._play = false;
        this.currentTime = 0
    }


    /** Current animation. */
    private _animation: Animation;

    /** Time of current animation. */
    private _time: number;

    /** Goal animation. */
    private _goalAnimation: Animation;

    /** Goal animation time. */
    private _goalTime: number;

    /** Crossfade time. */
    private _fadeTime: number;

    /** Crossfade duration. */
    private _fadeDuration: number;

    /** Controls playback. */
    private _play: boolean;


    /**
     * Ticks layer.
     *
     * @param deltaTime Time delta.
     */
    public _update(deltaTime: number): void {
        // Return if not playing.
        if (!this._play) {
            return;
        }


        // Progress time if playing.
        this._time += deltaTime;
        this._goalTime += deltaTime;
        this._fadeTime += deltaTime;
    }

    /**
     * Applies results to [[target]].
     *
     * @param target Target.
     */
    public _evaluate(target: Live2DCubismCore.Model, stackFlags: any): void {
        // Return if evaluation isn't possible.
        if (this._animation == null) {
            return;
        }


        // Clamp weight.
        let weight = (this.weight < 1)
            ? this.weight
            : 1;


        // Evaluate current animation.
        let animationWeight = (this._goalAnimation != null)
            ? (weight * this.weightCrossfade(this._fadeTime, this._fadeDuration))
            : weight;


        this._animation.evaluate(this._time, animationWeight, this.blend, target, stackFlags, this.groups);


        // Evaluate goal animation.
        if (this._goalAnimation != null) {
            animationWeight = 1 - (weight * this.weightCrossfade(this._fadeTime, this._fadeDuration));


            this._goalAnimation.evaluate(this._goalTime, animationWeight, this.blend, target, stackFlags, this.groups);


            // Finalize crossfade.
            if (this._fadeTime > this._fadeDuration) {
                this._animation = this._goalAnimation;
                this._time = this._goalTime;
                this._goalAnimation = null;
            }
        }
    }
}


/** Cubism animator. */
export class Animator {
    /** Target model. */
    public get target(): Live2DCubismCore.Model {
        return this._target;
    }

    /** Time scale. */
    public timeScale: number;

    /** Group of parameters */
    public groups: Groups;

    /**
     * Adds new animation layer.
     *
     * @param name
     * @param blender
     * @param weight
     */
    public addLayer(name: string, blender: IAnimationBlender = BuiltinAnimationBlenders.OVERRIDE, weight: number = 1) {
        // TODO Make sure layer name is unique.

        let layer = new AnimationLayer();

        layer.blend = blender;
        layer.weightCrossfade = BuiltinCrossfadeWeighters.LINEAR;
        layer.weight = weight;
        layer.groups = this.groups;

        this._layers.set(name, layer); // Overwrite if same name is exist.
    }

    /**
     * Gets layer by name.
     *
     * @param name Name.
     *
     * @return Animation layer if found; 'null' otherwise.
     */
    public getLayer(name: string): AnimationLayer {
        return this._layers.has(name)
            ? this._layers.get(name)
            : null;
    }

    /**
     * Remove animation layer specified by name.
     *
     * @param name
     */
    public removeLayer(name: string) {
        return this._layers.has(name)
            ? this._layers.delete(name)
            : null;
    }

    /** Updates and evaluates animation layers. */
    public updateAndEvaluate(deltaTime: number): void {
        // Scale delta time.
        deltaTime *= ((this.timeScale > 0)
            ? this.timeScale
            : 0);


        // Tick layers.
        if (deltaTime > 0.001) {
            this._layers.forEach((l) => {
                l._update(deltaTime);
            });
        }

        let paramStackFlags = new Array(this._target.parameters.count).fill(false);
        let partsStackFlags = new Array(this._target.parts.count).fill(false);
        let stackFlags = new Array(paramStackFlags,partsStackFlags);
        // Evaluate layers.
        this._layers.forEach((l) => {
            l._evaluate(this._target, stackFlags);
        });
    }


    /**
     * Creates animator.
     *
     * @param target Target.
     *
     * @return Animator on success; 'null' otherwise.
     */
    public static _create(target: Live2DCubismCore.Model, timeScale: number, layers: Map<string, AnimationLayer>): Animator {
        let animator = new Animator(target, timeScale,layers);


        return animator.isValid
            ? animator
            : null;
    }


    /** Target. */
    private _target: Live2DCubismCore.Model;

    /** Layers. */
    private _layers: Map<string, AnimationLayer>;

    /** 'true' if instance is valid; 'false' otherwise. */
    private get isValid(): boolean {
        return this._target != null;
    }


    /**
     * Creates instance.
     *
     * @param target Target.
     * @param timeScale Time scale.
     * @param layers Layers.
     */
    private constructor(target: Live2DCubismCore.Model, timeScale: number, layers: Map<string, AnimationLayer>) {
        this._target = target;
        this.timeScale = timeScale;
        this._layers = layers;
    }
}


/** Cubism [[Animator]] builder. */
export class AnimatorBuilder {
    /**
     * Sets target model.
     *
     * @param value Target.
     *
     * @return Builder.
     */
    public setTarget(value: Live2DCubismCore.Model): AnimatorBuilder {
        this._target = value;


        return this;
    }

    /**
     * Sets time scale.
     *
     * @param value Time scale.
     *
     * @return Builder.
     */
    public setTimeScale(value: number): AnimatorBuilder {
        this._timeScale = value;


        return this;
    }

    /**
     * Adds layer.
     *
     * @param name Name.
     * @param blender Blender.
     * @param weight Weight.
     *
     * @return Builder.
     */
    public addLayer(name: string, blender: IAnimationBlender = BuiltinAnimationBlenders.OVERRIDE, weight: number = 1) {
        // TODO Make sure layer name is unique.


        this._layerNames.push(name);
        this._layerBlenders.push(blender);
        this._layerCrossfadeWeighters.push(BuiltinCrossfadeWeighters.LINEAR);
        this._layerWeights.push(weight);


        return this;
    }

    /**
     * Builds [[Animator]].
     *
     * @return Animator on success; 'null' otherwise.
     */
    public build(): Animator {
        // TODO Validate state.


        // Create layers.
        let layers = new Map<string, AnimationLayer>();


        for (let l = 0; l < this._layerNames.length; ++l) {
            let layer = new AnimationLayer();


            layer.blend = this._layerBlenders[l];
            layer.weightCrossfade = this._layerCrossfadeWeighters[l];
            layer.weight = this._layerWeights[l];


            layers.set(this._layerNames[l], layer);
        }


        // Create animator.
        return Animator._create(this._target, this._timeScale, layers);
    }


    /** Target. */
    private _target: Live2DCubismCore.Model;

    /** Time scale. */
    private _timeScale: number = 1;

    /** Layer names. */
    private _layerNames: Array<string> = new Array<string>();

    /** Layer blenders. */
    private _layerBlenders: Array<IAnimationBlender> = new Array<IAnimationBlender>();

    /** Layer crossfade weighters. */
    private _layerCrossfadeWeighters: Array<IAnimationCrossfadeWeighter> = new Array<IAnimationCrossfadeWeighter>();

    /** Layer weights. */
    private _layerWeights: Array<number> = new Array<number>();
}

//#region  Animator section.
