// Cubism animation layer blender
export interface IAnimationBlender {
    (source: number, destination: number, initial: number, weight: number): number;
}

// Cubism animation cross-fade weighter
export interface IAnimationCrossfadeWeighter {
    (time: number, duration: number): number;
}

// Cubism animation segment evaluator
export interface IAnimationSegmentEvaluator {
    (points: Array<AnimationPoint>, offset: number, time: number): number;
}

/**
 * Builtin Cubism animation layer blenders
 */
export class BuiltinAnimationBlenders {
    public static OVERRIDE: IAnimationBlender = (source, destination, initial, weight) => {
        return ((destination * weight) + source * (1 - weight));
    };

    public static ADD: IAnimationBlender = (source, destination, initial, weight) => {
        return (source + ((destination - initial) * weight));
    };

    public static MULTIPLY: IAnimationBlender = (source, destination, weight) => {
        return (source * (1 + ((destination - 1) * weight)));
    }
}

/**
 * Cubism [[Animator]] builder
 */
export class AnimatorBuilder {
    private _target: Live2DCubismCore.Model | null = null;
    private _timeScale: number = 1;
    private _layers: Array<{
        name: string,
        blender: IAnimationBlender,
        crossfadeWeighter: IAnimationCrossfadeWeighter,
        weight: number
    }> = [];

    public setTarget(value: Live2DCubismCore.Model): void {
        this._target = value;
    }

    public setTimeScale(value: number): void {
        this._timeScale = value;
    }

    public addLayer(name: string, blender: IAnimationBlender = BuiltinAnimationBlenders.OVERRIDE, weight: number = 1): void {
        // TODO Make sure layer name is unique.

        this._layers.push({
            name,
            blender,
            crossfadeWeighter: BuiltinCrossfadeWeighters.LINEAR,
            weight
        });
    }

    public build(): Animator | void {
        // validate
        let hasError = false;
        if (this._target === null) {
            console.warn('target is not set...');
            hasError = true;
        }
        if (this._layers.length === 0) {
            console.warn('no layers has added...');
            hasError = true;
        }
        if (hasError) return;

        // Create layers.
        let layers = new Map<string, AnimationLayer>();
        for (let l = 0; l < this._layers.length; ++l) {
            let layer = new AnimationLayer();
            layer.blend = this._layers[l].blender;
            layer.weightCrossfade = this._layers[l].crossfadeWeighter;
            layer.weight = this._layers[l].weight;
            layers.set(this._layers[l].name, layer);
        }

        // Create animator.
        const target = this._target as Live2DCubismCore.Model;
        return new Animator(target, this._timeScale, layers);
    }
}

/**
 * cubism animator
 */
export class Animator {
    private _target: Live2DCubismCore.Model;
    private _timeScale: number;
    private _layers: Map<string, AnimationLayer>;

    get timeScale(): number {
        return this._timeScale;
    }

    get target(): Live2DCubismCore.Model {
        return this._target;
    }

    constructor(target: Live2DCubismCore.Model, timeScale: number, layers: Map<string, AnimationLayer>) {
        this._target = target;
        this._timeScale = timeScale;
        this._layers = layers;
    }

    public getLayer(name: string): AnimationLayer | null {
        if (this._layers.has(name)) {
            const layer = this._layers.get(name) as AnimationLayer;
            return layer;
        } else {
            return null;
        }
    }

    public removeLayer(name: string): void {
        if (this._layers.has(name)) this._layers.delete(name);
    }

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
}































/**
 * Cubism animation
 */
export class Animation {
    public duration: number;
    public fps: number;
    public loop: boolean;
    public userDataCount: number;
    public totalUserDataSize: number;
    public modelTracks: Array<AnimationTrack> = new Array<AnimationTrack>();
    public parameterTracks: Array<AnimationTrack> = new Array<AnimationTrack>();
    public partOpacityTracks: Array<AnimationTrack> = new Array<AnimationTrack>();
    public userDataBodys: Array<AnimationUserDataBody> = new Array<AnimationUserDataBody>();
    private _callbackFunctions: Array<(arg: string) => void> = [];
    private _lastTime: number = 0;

    constructor(motion3Json: any) {
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

            for (let t = 2; t < s.length; t += 3) {
                let offset = points.length - 1;
                let evaluate = BuiltinAnimationSegmentEvaluators.LINEAR;

                // Handle segment types.
                switch (s[t]) {
                    case 1:
                        evaluate = BuiltinAnimationSegmentEvaluators.BEZIER;
                        points.push(new AnimationPoint(s[t + 1], s[t + 2]));
                        points.push(new AnimationPoint(s[t + 3], s[t + 4]));
                        t += 4;
                        break;
                    case 2:
                        evaluate = BuiltinAnimationSegmentEvaluators.STEPPED;
                        break;
                    case 3:
                        evaluate = BuiltinAnimationSegmentEvaluators.INVERSE_STEPPED;
                        break;
                    default:
                        // TODO Handle unexpected segment type.
                        break;
                }

                // Push segment and point.
                points.push(new AnimationPoint(s[t + 1], s[t + 2]));
                segments.push(new AnimationSegment(offset, evaluate));
            }

            // Create track.
            let track = new AnimationTrack(c['Id'], points, segments);

            // Push track.
            switch (c['Target']) {
                case 'Model':
                    this.modelTracks.push(track);
                    break;
                case 'Parameter':
                    this.parameterTracks.push(track);
                    break;
                case 'PartOpacity':
                    this.partOpacityTracks.push(track);
                    break;
                default:
                    // TODO Handle unexpected target.
                    break;
            }
        });
    }

    public addAnimationCallback(callbackFunc: (arg: string) => void): void {
        this._callbackFunctions.push(callbackFunc);
    }

    public removeAnimationCallback(callbackFunc: (arg: string) => void): void {
        for (let _index = 0; _index < this._callbackFunctions.length; _index++) {
            if (this._callbackFunctions[_index] === callbackFunc) {
                this._callbackFunctions.splice(_index, 1);
                return;
            }
        }
    }

    public clearAnimationCallback(): void{
        this._callbackFunctions = [];
    }

    private callAnimationCallback(value: string): void {
        this._callbackFunctions.forEach(cb => cb(value));
    }

    public evaluate(
        time: number,
        weight: number,
        blend: IAnimationBlender,
        target: Live2DCubismCore.Model,
        stackFlags: any,
        groups: any = null
    ): void {
        // Return early if influence is minimal.
        if (weight <= 0.01) return;

        // Loop animation time if requested.
        if (this.loop) {
            while (time > this.duration) {
                time -= this.duration;
            }
        }

        // Evaluate tracks and apply results.
        this.parameterTracks.forEach(t => {
            let p = target.parameters.ids.indexOf(t.targetId);
            if (p >= 0) {
                if(stackFlags[0][p] != true) {
                    target.parameters.values[p] = target.parameters.defaultValues[p];
                    stackFlags[0][p] = true;
                }

                target.parameters.values[p] = blend(target.parameters.values[p], t.evaluate(time), t.evaluate(0), weight);
            }
        });

        this.partOpacityTracks.forEach(t => {
            let p = target.parts.ids.indexOf(t.targetId);
            if (p >= 0) {
                if(stackFlags[1][p] != true) {
                    target.parts.opacities[p] = 1;
                    stackFlags[1][p] = true;
                }

                target.parts.opacities[p] = blend(target.parts.opacities[p], t.evaluate(time), t.evaluate(0), weight);
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
                            if(stackFlags[0][p] != true) {
                                target.parameters.values[p] = target.parameters.defaultValues[p];
                                stackFlags[0][p] = true;
                            }

                            target.parameters.values[p] = blend(target.parameters.values[p], t.evaluate(time), t.evaluate(0), weight);
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
}

/**
 * Builtin Cubims crossfade
 */
export class BuiltinCrossfadeWeighters {
    public static LINEAR(time: number, duration: number): number {
        return (time / duration);
    }
}

/**
 * Cubism animation layer.
 */
export class AnimationLayer {
    private _animation: Animation | null = null;
    private _time: number = 0;
    private _goalAnimation: Animation | null = null;
    private _goalTime: number = 0;
    private _fadeTime: number = 0;
    private _fadeDuration: number = 0;
    private _play: boolean = false;

    public blend: IAnimationBlender = BuiltinAnimationBlenders.OVERRIDE;
    public weightCrossfade: IAnimationCrossfadeWeighter = BuiltinCrossfadeWeighters.LINEAR;
    public weight: number = 1;

    get currentAnimation(): Animation | null {
        return this._animation;
    }

    get currentTime(): number {
        return this._time;
    }

    set currentTime(value: number) {
        this._time = value;
    }

    get isPlaying(): boolean {
        return this._play;
    }

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

    public resume(): void {
        this._play = true;
    }

    public pause(): void {
        this._play = false;
    }

    public stop(): void {
        this._play = false;
        this.currentTime = 0
    }

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

        this._animation.evaluate(this._time, animationWeight, this.blend, target, stackFlags);

        // Evaluate goal animation.
        if (this._goalAnimation != null) {
            animationWeight = 1 - (weight * this.weightCrossfade(this._fadeTime, this._fadeDuration));


            this._goalAnimation.evaluate(this._goalTime, animationWeight, this.blend, target, stackFlags);


            // Finalize crossfade.
            if (this._fadeTime > this._fadeDuration) {
                this._animation = this._goalAnimation;
                this._time = this._goalTime;
                this._goalAnimation = null;
            }
        }
    }
}

/** Cubism animation track. */
export class AnimationTrack {
    constructor(public targetId: string, public points: Array<AnimationPoint>, public segments: Array<AnimationSegment>) {}

    public evaluate(time: number): number {
        // Find segment to evaluate.
        let s = 0;
        let lastS = this.segments.length - 1;
        for(; s < lastS; ++s) {
            if (this.points[this.segments[s + 1].offset].time >= time) break;
        }

        // Evaluate segment.
        // TODO Passing segment offset somewhat to itself is awkward. Improve it?
        return this.segments[s].evaluate(this.points, this.segments[s].offset, time);
    }
}

/**
 * Unit of animation user data
 */
export class AnimationUserDataBody{
    public constructor (public time: number, public value: string) {};
}

/**
 * Cubism animation point
 */
export class AnimationPoint {
    public constructor(public time: number, public value: number) {}
}

/**
 * Cubism animation track segment
 */
export class AnimationSegment {
    public constructor(public offset: number, public evaluate: IAnimationSegmentEvaluator) {}
}

/**
 * Builtin Cubism animation segment evaluators
 */
export class BuiltinAnimationSegmentEvaluators {
    public static LINEAR: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        let p0 = points[offset + 0];
        let p1 = points[offset + 1];
        let t = (time - p0.time) / (p1.time - p0.time);
        return (p0.value + ((p1.value - p0.value) * t));
    };

    public static BEZIER: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        let t = (time - points[offset + 0].time) / (points[offset + 3].time - points[offset].time);


        let p01 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 0], points[offset + 1], t);
        let p12 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 1], points[offset + 2], t);
        let p23 = BuiltinAnimationSegmentEvaluators.lerp(points[offset + 2], points[offset + 3], t);

        let p012 = BuiltinAnimationSegmentEvaluators.lerp(p01, p12, t);
        let p123 = BuiltinAnimationSegmentEvaluators.lerp(p12, p23, t);


        return BuiltinAnimationSegmentEvaluators.lerp(p012, p123, t).value;
    };

    public static STEPPED: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        return points[offset + 0].value;
    };

    public static INVERSE_STEPPED: IAnimationSegmentEvaluator = function(points: Array<AnimationPoint>, offset: number, time: number): number {
        return points[offset + 1].value;
    };

    private static lerp(a: AnimationPoint, b: AnimationPoint, t: number): AnimationPoint {
        return new AnimationPoint((a.time + ((b.time - a.time) * t)), (a.value + ((b.value - a.value) * t)));
    };
}
