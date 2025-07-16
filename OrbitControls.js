// Simple OrbitControls implementation for Cricket Game
THREE.OrbitControls = function (object, domElement) {
    this.object = object;
    this.domElement = domElement !== undefined ? domElement : document;

    // Set to false to disable this control
    this.enabled = true;

    // "target" sets the location of focus, where the object orbits around
    this.target = new THREE.Vector3();

    // How far you can dolly in and out (PerspectiveCamera only)
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // How far you can zoom in and out (OrthographicCamera only)
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    this.minAzimuthAngle = -Infinity; // radians
    this.maxAzimuthAngle = Infinity; // radians

    // Set to true to enable damping (inertia)
    this.enableDamping = false;
    this.dampingFactor = 0.05;

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

    // Set to false to disable rotating
    this.enableRotate = true;
    this.rotateSpeed = 1.0;

    // Set to false to disable panning
    this.enablePan = true;
    this.panSpeed = 1.0;

    // internals
    var scope = this;
    var changeEvent = { type: 'change' };
    var startEvent = { type: 'start' };
    var endEvent = { type: 'end' };

    var STATE = {
        NONE: -1,
        ROTATE: 0,
        DOLLY: 1,
        PAN: 2,
        TOUCH_ROTATE: 3,
        TOUCH_PAN: 4,
        TOUCH_DOLLY_PAN: 5,
        TOUCH_DOLLY_ROTATE: 6
    };

    var state = STATE.NONE;

    var EPS = 0.000001;

    // current position in spherical coordinates
    var spherical = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();

    var scale = 1;
    var panOffset = new THREE.Vector3();
    var zoomChanged = false;

    var rotateStart = new THREE.Vector2();
    var rotateEnd = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();

    var panStart = new THREE.Vector2();
    var panEnd = new THREE.Vector2();
    var panDelta = new THREE.Vector2();

    var dollyStart = new THREE.Vector2();
    var dollyEnd = new THREE.Vector2();
    var dollyDelta = new THREE.Vector2();

    function getAutoRotationAngle() {
        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
    }

    function getZoomScale() {
        return Math.pow(0.95, scope.zoomSpeed);
    }

    function rotateLeft(angle) {
        sphericalDelta.theta -= angle;
    }

    function rotateUp(angle) {
        sphericalDelta.phi -= angle;
    }

    var panLeft = function () {
        var v = new THREE.Vector3();
        return function panLeft(distance, objectMatrix) {
            v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
            v.multiplyScalar(-distance);
            panOffset.add(v);
        };
    }();

    var panUp = function () {
        var v = new THREE.Vector3();
        return function panUp(distance, objectMatrix) {
            v.setFromMatrixColumn(objectMatrix, 1); // get Y column of objectMatrix
            v.multiplyScalar(distance);
            panOffset.add(v);
        };
    }();

    // deltaX and deltaY are in pixels; right and down are positive
    var pan = function () {
        var offset = new THREE.Vector3();
        return function pan(deltaX, deltaY) {
            var element = scope.domElement;
            if (scope.object.isPerspectiveCamera) {
                // perspective
                var position = scope.object.position;
                offset.copy(position).sub(scope.target);
                var targetDistance = offset.length();

                // half of the fov is center to top of screen
                targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0);

                // we use only clientHeight here so aspect ratio does not distort speed
                panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix);
                panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix);
            }
        };
    }();

    function dollyOut(dollyScale) {
        if (scope.object.isPerspectiveCamera) {
            scale /= dollyScale;
        } else {
            scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale));
            scope.object.updateProjectionMatrix();
            zoomChanged = true;
        }
    }

    function dollyIn(dollyScale) {
        if (scope.object.isPerspectiveCamera) {
            scale *= dollyScale;
        } else {
            scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale));
            scope.object.updateProjectionMatrix();
            zoomChanged = true;
        }
    }

    //
    // event callbacks - update the object state
    //

    function handleMouseDownRotate(event) {
        rotateStart.set(event.clientX, event.clientY);
    }

    function handleMouseDownDolly(event) {
        dollyStart.set(event.clientX, event.clientY);
    }

    function handleMouseDownPan(event) {
        panStart.set(event.clientX, event.clientY);
    }

    function handleMouseMoveRotate(event) {
        rotateEnd.set(event.clientX, event.clientY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        var element = scope.domElement;
        rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height
        rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
    }

    function handleMouseMoveDolly(event) {
        dollyEnd.set(event.clientX, event.clientY);
        dollyDelta.subVectors(dollyEnd, dollyStart);
        if (dollyDelta.y > 0) {
            dollyOut(getZoomScale());
        } else if (dollyDelta.y < 0) {
            dollyIn(getZoomScale());
        }
        dollyStart.copy(dollyEnd);
        scope.update();
    }

    function handleMouseMovePan(event) {
        panEnd.set(event.clientX, event.clientY);
        panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);
        pan(panDelta.x, panDelta.y);
        panStart.copy(panEnd);
        scope.update();
    }

    function handleMouseWheel(event) {
        if (event.deltaY < 0) {
            dollyIn(getZoomScale());
        } else if (event.deltaY > 0) {
            dollyOut(getZoomScale());
        }
        scope.update();
    }

    function onMouseDown(event) {
        if (scope.enabled === false) return;
        event.preventDefault();
        
        switch (event.button) {
            case 0: // left
                if (event.ctrlKey || event.metaKey || event.shiftKey) {
                    if (scope.enablePan === false) return;
                    handleMouseDownPan(event);
                    state = STATE.PAN;
                } else {
                    if (scope.enableRotate === false) return;
                    handleMouseDownRotate(event);
                    state = STATE.ROTATE;
                }
                break;
            case 1: // middle
                if (scope.enableZoom === false) return;
                handleMouseDownDolly(event);
                state = STATE.DOLLY;
                break;
            case 2: // right
                if (scope.enablePan === false) return;
                handleMouseDownPan(event);
                state = STATE.PAN;
                break;
        }

        if (state !== STATE.NONE) {
            scope.domElement.addEventListener('mousemove', onMouseMove, false);
            scope.domElement.addEventListener('mouseup', onMouseUp, false);
        }
    }

    function onMouseMove(event) {
        if (scope.enabled === false) return;
        event.preventDefault();

        switch (state) {
            case STATE.ROTATE:
                if (scope.enableRotate === false) return;
                handleMouseMoveRotate(event);
                break;
            case STATE.DOLLY:
                if (scope.enableZoom === false) return;
                handleMouseMoveDolly(event);
                break;
            case STATE.PAN:
                if (scope.enablePan === false) return;
                handleMouseMovePan(event);
                break;
        }
    }

    function onMouseUp(event) {
        if (scope.enabled === false) return;
        scope.domElement.removeEventListener('mousemove', onMouseMove, false);
        scope.domElement.removeEventListener('mouseup', onMouseUp, false);
        state = STATE.NONE;
    }

    function onMouseWheel(event) {
        if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) return;
        event.preventDefault();
        event.stopPropagation();
        handleMouseWheel(event);
    }

    this.update = function () {
        var offset = new THREE.Vector3();
        var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
        var quatInverse = quat.clone().invert();
        var lastPosition = new THREE.Vector3();
        var lastQuaternion = new THREE.Quaternion();

        return function update() {
            var position = scope.object.position;
            offset.copy(position).sub(scope.target);
            offset.applyQuaternion(quat);
            spherical.setFromVector3(offset);

            spherical.theta += sphericalDelta.theta;
            spherical.phi += sphericalDelta.phi;

            spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));
            spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
            spherical.makeSafe();
            spherical.radius *= scale;
            spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

            scope.target.add(panOffset);
            offset.setFromSpherical(spherical);
            offset.applyQuaternion(quatInverse);
            position.copy(scope.target).add(offset);
            scope.object.lookAt(scope.target);

            if (scope.enableDamping === true) {
                sphericalDelta.theta *= (1 - scope.dampingFactor);
                sphericalDelta.phi *= (1 - scope.dampingFactor);
                panOffset.multiplyScalar(1 - scope.dampingFactor);
            } else {
                sphericalDelta.set(0, 0, 0);
                panOffset.set(0, 0, 0);
            }

            scale = 1;

            if (zoomChanged ||
                lastPosition.distanceToSquared(scope.object.position) > EPS ||
                8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {
                lastPosition.copy(scope.object.position);
                lastQuaternion.copy(scope.object.quaternion);
                zoomChanged = false;
                return true;
            }
            return false;
        };
    }();

    this.dispose = function () {
        scope.domElement.removeEventListener('contextmenu', onContextMenu, false);
        scope.domElement.removeEventListener('mousedown', onMouseDown, false);
        scope.domElement.removeEventListener('wheel', onMouseWheel, false);
    };

    function onContextMenu(event) {
        if (scope.enabled === false) return;
        event.preventDefault();
    }

    scope.domElement.addEventListener('contextmenu', onContextMenu, false);
    scope.domElement.addEventListener('mousedown', onMouseDown, false);
    scope.domElement.addEventListener('wheel', onMouseWheel, false);

    this.update();
};
