import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import "./style.css";

const gltfLoader = new GLTFLoader();





// ======================================================
// SCENE
// ======================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01040a);

// ======================================================
// CAMERA
// ======================================================

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.001,
    1000000
);

camera.position.set(0, 0, 5);

// ======================================================
// RENDERER
// ======================================================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.outputColorSpace =
    THREE.SRGBColorSpace;

document.body.appendChild(
    renderer.domElement
);

// ======================================================
// CONTROLS
// ======================================================

const controls =
    new OrbitControls(
        camera,
        renderer.domElement
    );

controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.minDistance = 0.1;
controls.maxDistance = 100000;

controls.target.set(0, 0, 0);

// ======================================================
// LIGHTING
// ======================================================

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        0.12
    );

scene.add(
    ambientLight
);
const sunLight =
    new THREE.DirectionalLight(
        0xffffff,
        2.5
    );

sunLight.position.set(
    5,
    3,
    5
);

scene.add(
    sunLight
);



// ======================================================
// STARS
// ======================================================

const starGeometry =
    new THREE.BufferGeometry();

const starCount = 5000;

const positions =
    new Float32Array(
        starCount * 3
    );

for (
    let i = 0;
    i < starCount * 3;
    i++
) {
    positions[i] =
        (Math.random() - 0.5) * 200;
}

starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
        positions,
        3
    )
);

const starMaterial =
    new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.05
    });

const stars =
    new THREE.Points(
        starGeometry,
        starMaterial
    );

scene.add(stars);

// ======================================================
// EARTH
// ======================================================

const earthGroup =
    new THREE.Group();

scene.add(earthGroup);

let earth = null;

let earthRadius = 1;

const loader =
    new GLTFLoader();



console.log(
    "Loading Earth GLB..."
);




loader.load(

    "/models/earth.glb",
function (gltf) {

        console.log(
            "EARTH GLB LOADED!"
        );

       earth = gltf.scene;

// ======================================================
// EARTH MATERIAL SETUP
// ======================================================

earth = gltf.scene;

earth.traverse((child) => {

    if (!child.isMesh) return;

   if (child.name === "Earth") {

    const material = child.material;

    if (material.map) {
        material.map.colorSpace =
            THREE.SRGBColorSpace;
    }

   // if (material.normalMap) {
   //     material.normalMap.colorSpace =
   //         THREE.NoColorSpace;
   // }

    material.color.set(0xffffff);

    material.emissive.set(0x000000);
    material.emissiveIntensity = 0;

    material.metalness = 0;

    material.roughness = 0;

    material.needsUpdate = true;
}

    if (child.name === "Atmosphere") {

    child.visible = false;

    child.material.transparent = true;
    child.material.opacity = 0.12;
    child.material.depthWrite = false;

    child.material.side =
        THREE.FrontSide;

    child.material.needsUpdate = true;
}
});



        // ----------------------------------------------
        // Add model
        // ----------------------------------------------

        earthGroup.add(
            earth
        );
// ======================================================
// CINEMATIC EARTH ATMOSPHERE
// ======================================================
function showLocation(position) {
    const locationInfo = document.getElementById("locationInfo");

    if (!locationInfo) return;

    // Convert Three.js coordinates back to approximate API coordinates
    const EARTH_RADIUS_KM = 6371;
    const scale = earthRadius / EARTH_RADIUS_KM;

    const x = position.x / scale;
    const y = position.z / scale;
    const z = position.y / scale;

    locationInfo.innerHTML = `
        <strong>Current Location</strong><br>
        X: ${x.toFixed(2)} km<br>
        Y: ${y.toFixed(2)} km<br>
        Z: ${z.toFixed(2)} km
    `;
}

function createAtmosphere() {

    const atmosphereGeometry =
        new THREE.SphereGeometry(
            earthRadius * 1.015,
            128,
            128
        );

    const atmosphereMaterial =
        new THREE.ShaderMaterial({

            transparent: true,

            side: THREE.BackSide,

            blending:
                THREE.AdditiveBlending,

            depthWrite: false,

            uniforms: {

                glowColor: {
                    value:
                        new THREE.Color(
                            0x168cff
                        )
                }

            },

            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {

                    vNormal =
                        normalize(
                            mat3(modelMatrix) *
                            normal
                        );

                    vec4 worldPosition =
                        modelMatrix *
                        vec4(position, 1.0);

                    vWorldPosition =
                        worldPosition.xyz;

                    gl_Position =
                        projectionMatrix *
                        viewMatrix *
                        worldPosition;
                }
            `,

            fragmentShader: `
                uniform vec3 glowColor;

                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {

                    vec3 viewDirection =
                        normalize(
                            cameraPosition -
                            vWorldPosition
                        );

                    float fresnel =
                        1.0 -
                        max(
                            dot(
                                normalize(vNormal),
                                viewDirection
                            ),
                            0.0
                        );

                    fresnel =
                        pow(
                            fresnel,
                            5.0
                        );

                    float alpha =
                        fresnel * 0.45;

                    if (alpha < 0.015) {
                        discard;
                    }

                    gl_FragColor =
                        vec4(
                            glowColor,
                            alpha
                        );
                }
            `
        });

    const atmosphere =
        new THREE.Mesh(
            atmosphereGeometry,
            atmosphereMaterial
        );

    atmosphere.name =
        "CinematicAtmosphere";

    earthGroup.add(
        atmosphere
    );
}

        // ----------------------------------------------
        // Calculate bounding box
        // ----------------------------------------------

        const box =
            new THREE.Box3()
                .setFromObject(
                    earth
                );

        const size =
            new THREE.Vector3();

        box.getSize(
            size
        );

        const center =
            new THREE.Vector3();

        box.getCenter(
            center
        );

        console.log(
            "GLB SIZE:",
            size
        );

        console.log(
            "GLB CENTER:",
            center
        );

        // ----------------------------------------------
        // Center model
        // ----------------------------------------------

        earth.position.x -=
            center.x;

        earth.position.y -=
            center.y;

        earth.position.z -=
            center.z;

        // ----------------------------------------------
        // Find radius
        // ----------------------------------------------

        const sphere =
            new THREE.Sphere();

        box.getBoundingSphere(
            sphere
        );

        earthRadius =
            sphere.radius;

        console.log(
            "EARTH RADIUS:",
            earthRadius
        );

        // ----------------------------------------------
        // FORCE EARTH TO A REASONABLE SIZE
        // ----------------------------------------------

        const targetRadius = 2;

        const scale =
            targetRadius /
            earthRadius;

        earth.scale.setScalar(
            scale
        );

        earthRadius =
            targetRadius;
           // createAtmosphere();

        console.log(
            "EARTH SCALE:",
            scale
        );

        // ----------------------------------------------
        // Put camera at correct distance
        // ----------------------------------------------

        camera.position.set(
            0,
            0,
            earthRadius * 3
        );

        controls.target.set(
            0,
            0,
            0
        );

        controls.update();

        // ----------------------------------------------
        // Load debris
        // ----------------------------------------------

        
       loadSpaceObjects();
       loadSimulation();
       loadCollisionData();
    },

    function (progress) {

        if (progress.total > 0) {

            console.log(
                "Earth loading:",
                (
                    progress.loaded /
                    progress.total *
                    100
                ).toFixed(1),
                "%"
            );

        }

    },

    function (error) {

        console.error(
            "EARTH GLB ERROR:",
            error
        );

    }
);

// ======================================================
// DEBRIS
// ======================================================

const debrisGroup =
    new THREE.Group();

scene.add(
    debrisGroup
);

const trajectoryGroup = new THREE.Group();
scene.add(trajectoryGroup);

const riskHighlightGroup = new THREE.Group();
scene.add(riskHighlightGroup);

// Global debris simulation
let simulationData = null;
let simulationStartTime = null;

// 1 = real-time
// 60 = 60x faster than real-time
let simulationSpeed = 1;

const speedButton =
    document.getElementById("speedButton");

const simulationSpeeds = [
    1,
    5,
    10,
    30,
    60
];

let currentSpeedIndex = 4;

speedButton.addEventListener("click", () => {

    currentSpeedIndex++;

    if (
        currentSpeedIndex >=
        simulationSpeeds.length
    ) {
        currentSpeedIndex = 0;
    }

    simulationSpeed =
        simulationSpeeds[currentSpeedIndex];

    speedButton.textContent =
        `Speed: ${simulationSpeed}×`;

    console.log(
        "SIMULATION SPEED:",
        simulationSpeed,
        "x"
    );
});

const raycaster =
    new THREE.Raycaster();

const mouse =
    new THREE.Vector2();

// ======================================================
// OBJECT SELECTION
// ======================================================

// ======================================================
// OBJECT SELECTION
// ======================================================

let selectedMarker = null;
let selectedPositionMarker = null;
let activeTrajectory = null;
let activeObjectMarker = null;

window.addEventListener("click", (event) => {

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(
        debrisGroup.children,
        true
    );

    if (intersects.length === 0) return;

    let selected = intersects[0].object;

    while (
        selected &&
        (!selected.userData || !selected.userData.object_id)
    ) {
        selected = selected.parent;
    }

    if (!selected) return;

    const object = selected.userData;

    console.log("SELECTED OBJECT:", object);

    // Show numerical current position
    showLocation(object, selected.position);

    showTrajectory(object.object_id);
});


// ======================================================
// CONVERT API COORDINATES
// ======================================================

function apiPosition(object) {

    const EARTH_RADIUS_KM = 6371;

    const scale =
        earthRadius / EARTH_RADIUS_KM;

    return new THREE.Vector3(
        object.x * scale,
        object.z * scale,
        object.y * scale
    );
}

function showLocation(object, position) {
    const locationInfo = document.getElementById("locationInfo");

    if (!locationInfo) return;

    const EARTH_RADIUS_KM = 6371;
    const scale = earthRadius / EARTH_RADIUS_KM;

    const x = position.x / scale;
    const y = position.z / scale;
    const z = position.y / scale;

 // Velocity from API
const velocity = object.velocity_km_s || [0, 0, 0];

const vx = velocity[0];
const vy = velocity[1];
const vz = velocity[2];

const speed = Math.sqrt(
    vx * vx +
    vy * vy +
    vz * vz
);

    locationInfo.innerHTML = `
        <strong>Current Location</strong><br>
        X: ${x.toFixed(2)} km<br>
        Y: ${y.toFixed(2)} km<br>
        Z: ${z.toFixed(2)} km

        <br><br>

        <strong>Velocity</strong><br>
        Vx: ${vx.toFixed(3)} km/s<br>
        Vy: ${vy.toFixed(3)} km/s<br>
        Vz: ${vz.toFixed(3)} km/s<br>
        Speed: ${speed.toFixed(3)} km/s
    `;
}
// ======================================================
// TRAJECTORY GROUP
// ======================================================

function clearTrajectories() {

    while (trajectoryGroup.children.length > 0) {

        const object =
            trajectoryGroup.children[0];

        trajectoryGroup.remove(object);

        if (object.geometry) {
            object.geometry.dispose();
        }

        if (object.material) {
            object.material.dispose();
        }
    }

    activeTrajectory = null;
}


// ======================================================
// SHOW TRAJECTORY
// ======================================================

async function showTrajectory(objectId) {

    try {

        console.log(
            "Loading trajectory for object:",
            objectId
        );

        const response = await fetch(
            `http://127.0.0.1:8000/api/trajectory/${objectId}?hours=24&step_minutes=10`
        );

        if (!response.ok) {

            throw new Error(
                `Trajectory API returned ${response.status}`
            );
        }

        const data =
            await response.json();

        console.log(
            "TRAJECTORY DATA:",
            data
        );

        clearTrajectories();

        if (
            !data.trajectory ||
            data.trajectory.length === 0
        ) {

            console.warn(
                "No trajectory points received"
            );

            return;
        }

        activeTrajectory =
            data.trajectory;

        const points = [];

        for (
            const point of data.trajectory
        ) {

            points.push(
                apiPosition(point)
            );
        }

        const geometry =
            new THREE.BufferGeometry()
                .setFromPoints(points);

        const material =
            new THREE.LineBasicMaterial({
                color: 0x00ffff
            });

        const trajectory =
            new THREE.Line(
                geometry,
                material
            );

        trajectoryGroup.add(
            trajectory
        );

        // Put selected position marker at
        // the CURRENT position of the trajectory
        if (
            selectedPositionMarker &&
            points.length > 0
        ) {

            selectedPositionMarker.position.copy(
                points[0]
            );
        }

        console.log(
            "TRAJECTORY RENDERED:",
            points.length,
            "points"
        );

    } catch (error) {

        console.error(
            "TRAJECTORY ERROR:",
            error
        );
    }
}
// ======================================================
// ADD SECOND TRAJECTORY
// ======================================================

async function addTrajectory(objectId) {

    try {

        const response = await fetch(
            `http://127.0.0.1:8000/api/trajectory/${objectId}?hours=24&step_minutes=10`
        );

        if (!response.ok) {

            throw new Error(
                `Trajectory API returned ${response.status}`
            );
        }

        const data =
            await response.json();

        if (
            !data.trajectory ||
            data.trajectory.length === 0
        ) {

            return;
        }

        const points = [];

        for (
            const point of data.trajectory
        ) {

            points.push(
                apiPosition(point)
            );
        }

        const geometry =
            new THREE.BufferGeometry()
                .setFromPoints(points);

        const material =
            new THREE.LineBasicMaterial({
                color: 0xffaa00
            });

        const trajectory =
            new THREE.Line(
                geometry,
                material
            );

        trajectoryGroup.add(
            trajectory
        );

    } catch (error) {

        console.error(
            "SECOND TRAJECTORY ERROR:",
            error
        );
    }
}

function highlightCollisionObjects(
    objectAId,
    objectBId
) {

    // Remove previous collision highlights
    riskHighlightGroup.clear();

    const objects = [
        {
            id: objectAId,
            color: 0xff3333
        },
        {
            id: objectBId,
            color: 0xffaa00
        }
    ];

    objects.forEach(item => {

        const marker =
            debrisGroup.children.find(
                child =>
                    child.userData &&
                    child.userData.object_id ===
                    item.id
            );

        if (!marker) {
            return;
        }

        const geometry =
            new THREE.SphereGeometry(
                earthRadius * 0.012,
                20,
                20
            );

        const material =
            new THREE.MeshBasicMaterial({
                color: item.color
            });

        const highlight =
            new THREE.Mesh(
                geometry,
                material
            );

        highlight.position.copy(
            marker.position
        );

        riskHighlightGroup.add(
            highlight
        );
    });
}

// ======================================================
// SHOW CALCULATED COLLISION / CLOSE-APPROACH LOCATION
// ======================================================

async function showCollisionLocation(
    objectAId,
    objectBId
) {

    try {

        const [responseA, responseB] =
            await Promise.all([

                fetch(
                    `http://127.0.0.1:8000/api/trajectory/${objectAId}?hours=24&step_minutes=10`
                ),

                fetch(
                    `http://127.0.0.1:8000/api/trajectory/${objectBId}?hours=24&step_minutes=10`
                )
            ]);

        if (
            !responseA.ok ||
            !responseB.ok
        ) {

            throw new Error(
                "Could not load collision trajectories"
            );
        }

        const dataA =
            await responseA.json();

        const dataB =
            await responseB.json();

        const trajectoryA =
            dataA.trajectory;

        const trajectoryB =
            dataB.trajectory;

        if (
            !trajectoryA ||
            !trajectoryB ||
            trajectoryA.length === 0 ||
            trajectoryB.length === 0
        ) {

            console.warn(
                "Missing trajectory data for collision location"
            );

            return;
        }

        let minimumDistance =
            Infinity;

        let closestPositionA = null;
        let closestPositionB = null;

        const count =
            Math.min(
                trajectoryA.length,
                trajectoryB.length
            );

        // Find closest matching trajectory points
        for (let i = 0; i < count; i++) {

            const positionA =
                apiPosition(
                    trajectoryA[i]
                );

            const positionB =
                apiPosition(
                    trajectoryB[i]
                );

            const distance =
                positionA.distanceTo(
                    positionB
                );

            if (
                distance <
                minimumDistance
            ) {

                minimumDistance =
                    distance;

                closestPositionA =
                    positionA.clone();

                closestPositionB =
                    positionB.clone();
            }
        }

        if (
            !closestPositionA ||
            !closestPositionB
        ) {
            return;
        }

        // The collision / closest-approach
        // location is halfway between both objects
        const collisionPosition =
            closestPositionA
                .clone()
                .add(closestPositionB)
                .multiplyScalar(0.5);

            showLocation(collisionPosition);

        // Remove old collision-location markers
        const oldMarkers =
            riskHighlightGroup.children
                .filter(
                    child =>
                        child.userData &&
                        child.userData.collisionLocation
                );

        oldMarkers.forEach(marker => {

            riskHighlightGroup.remove(marker);

            marker.geometry.dispose();
            marker.material.dispose();
        });

        // Outer ring
        const geometry =
            new THREE.SphereGeometry(
                earthRadius * 0.025,
                24,
                24
            );

        const material =
            new THREE.MeshBasicMaterial({
                color: 0xffff00
            });

        const collisionMarker =
            new THREE.Mesh(
                geometry,
                material
            );

        collisionMarker.position.copy(
            collisionPosition
        );

        collisionMarker.userData = {
            collisionLocation: true
        };

        riskHighlightGroup.add(
            collisionMarker
        );

        // Smaller bright center
        const centerGeometry =
            new THREE.SphereGeometry(
                earthRadius * 0.01,
                16,
                16
            );

        const centerMaterial =
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            });

        const centerMarker =
            new THREE.Mesh(
                centerGeometry,
                centerMaterial
            );

        centerMarker.position.copy(
            collisionPosition
        );

        centerMarker.userData = {
            collisionLocation: true
        };

        riskHighlightGroup.add(
            centerMarker
        );

        console.log(
            "CALCULATED CLOSEST APPROACH:",
            minimumDistance,
            "scene units"
        );

        console.log(
            "COLLISION LOCATION:",
            collisionPosition
        );

    } catch (error) {

        console.error(
            "COLLISION LOCATION ERROR:",
            error
        );
    }
}




// ======================================================
// CREATE DEBRIS MARKER
// ======================================================

function createMarker(object) {

    const geometry = new THREE.SphereGeometry(
        earthRadius * 0.008,
        8,
        8
    );

    const material = new THREE.MeshBasicMaterial({
        color: 0xff3333
    });

    const marker = new THREE.Mesh(
        geometry,
        material
    );

    marker.position.copy(
        apiPosition(object)
    );

    marker.userData = object;

    return marker;
}


// ======================================================
// LOAD API
// ======================================================

async function loadSpaceObjects() {
    try {
        console.log("Fetching orbital data...");

        const response = await fetch(
            "http://127.0.0.1:8000/api/objects"
        );

        const data = await response.json();

        const objects = data.objects;

        console.log("OBJECT COUNT:", objects.length);

        while (debrisGroup.children.length > 0) {
            debrisGroup.remove(debrisGroup.children[0]);
        }

        objects.forEach((object) => {

            const marker = createMarker(object);

            debrisGroup.add(marker);

        });

        console.log(
            "DEBRIS RENDERED:",
            debrisGroup.children.length
        );

    } catch (error) {

        console.error(
            "API ERROR:",
            error
        );

    }
}
async function loadSimulation() {

    try {

        console.log("Loading global debris simulation...");

        const response = await fetch(
            "http://127.0.0.1:8000/api/simulation?hours=24&step_minutes=10"
        );

        if (!response.ok) {
            throw new Error(
                `Simulation API returned ${response.status}`
            );
        }

        simulationData = await response.json();

        console.log(
            "SIMULATION LOADED:",
            simulationData.object_count,
            "objects"
        );

        console.log(
            "SIMULATION FRAMES:",
            simulationData.frame_count
        );

        // Start simulation clock
        simulationStartTime = performance.now();

        // Put every debris object at the first simulation position
        updateAllDebris();

    } catch (error) {

        console.error(
            "SIMULATION ERROR:",
            error
        );

    }
}

function updateAllDebris() {

    if (!simulationData || !simulationStartTime) {
        return;
    }

    const frames = simulationData.frames;

    if (!frames || frames.length < 2) {
        return;
    }

    // Real elapsed time
    const elapsedSeconds =
        (performance.now() - simulationStartTime) / 1000;

    // Convert to simulation time
    const simulatedSeconds =
        elapsedSeconds * simulationSpeed;

    const stepSeconds =
        simulationData.step_minutes * 60;

    const totalSteps = frames.length - 1;

    // Loop simulation after reaching the end
    const exactFrame =
        (simulatedSeconds / stepSeconds) % totalSteps;

    const frameAIndex =
        Math.floor(exactFrame);

    const frameBIndex =
        (frameAIndex + 1) % frames.length;

    const interpolation =
        exactFrame - frameAIndex;

    const frameA =
        frames[frameAIndex];

    const frameB =
        frames[frameBIndex];

    // Move every debris object
    for (const objectA of frameA.objects) {

        const marker =
            debrisGroup.children.find(
                child =>
                    child.userData.object_id ===
                    objectA.object_id
            );

        if (!marker) {
            continue;
        }

        const objectB =
            frameB.objects.find(
                object =>
                    object.object_id ===
                    objectA.object_id
            );

        if (!objectB) {
            continue;
        }

        const positionA =
            apiPosition(objectA);

        const positionB =
            apiPosition(objectB);

        const position =
            positionA.clone().lerp(
                positionB,
                interpolation
            );

        marker.position.copy(position);
    }
}

// ======================================================
// RESIZE
// ======================================================

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }
);


// ======================================================
// ANIMATION
// ======================================================

function animate() {

    requestAnimationFrame(animate);

    controls.update();

    if (earth) {
        earth.rotation.y += 0.0002;
    }

    // Move all debris continuously
    updateAllDebris();

    renderer.render(scene, camera);
}

animate();

document
    .getElementById("refreshCollisions")
    .addEventListener("click", () => {
        loadCollisionData();
    });

async function loadCollisionData() {
    const status = document.getElementById("collisionStatus");

    status.textContent = "Analyzing 24-hour orbital close approaches...";

    try {
        const response = await fetch(
            "http://127.0.0.1:8000/api/collisions?hours=24&step_minutes=10&threshold_km=25&limit=20"
        );

        const data = await response.json();

        if (data.status !== "success") {
            throw new Error("Collision API returned an error");
        }

        updateCollisionPanel(data);

        console.log("COLLISION DATA:", data);

    } catch (error) {
        console.error("Collision analysis failed:", error);

        status.textContent =
            "Unable to load collision-risk analysis.";
    }
}

function updateCollisionPanel(data) {

    document.getElementById("criticalCount").textContent =
        data.summary.critical;

    document.getElementById("highCount").textContent =
        data.summary.high;

    document.getElementById("mediumCount").textContent =
        data.summary.medium;

    document.getElementById("lowCount").textContent =
        data.summary.low;

    document.getElementById("objectsAnalyzed").textContent =
        data.objects_analyzed;

    document.getElementById("thresholdValue").textContent =
        `${data.screening_threshold_km} km`;

    document.getElementById("approachCount").textContent =
        data.close_approaches;

    const status = document.getElementById("collisionStatus");

    status.textContent =
        `Analysis complete · ${data.forecast_hours}h forecast`;

    const eventsContainer =
        document.getElementById("collisionEvents");

    eventsContainer.innerHTML = "";

    if (data.events.length === 0) {

        eventsContainer.innerHTML = `
            <div style="color:#9fb3c8; padding:10px 0;">
                No close approaches detected within
                ${data.screening_threshold_km} km.
            </div>
        `;

        return;
    }

    data.events.forEach(event => {

    const eventElement = document.createElement("div");

    const riskClass =
    `risk-${event.risk_level.toLowerCase()}`;

    eventElement.className =
        `collision-event ${riskClass}`;

    eventElement.innerHTML = `
    <div class="event-title">
        ${event.object_1.name}
        ↔
        ${event.object_2.name}
    </div>

    <div class="event-distance">
        Minimum distance:
        <strong>${event.minimum_distance_km} km</strong>
    </div>

    <div class="event-distance">
        Risk:
        <strong>${event.risk_level}</strong>
    </div>

    <div class="event-distance">
        Closest approach:
        <strong>${new Date(event.time).toLocaleString()}</strong>
    </div>
`;

eventElement.addEventListener("click", async () => {

    console.log(
        "RISK EVENT SELECTED:",
        event
    );

    // Remove selected debris marker
    if (selectedPositionMarker) {

        scene.remove(
            selectedPositionMarker
        );

        selectedPositionMarker.geometry.dispose();
        selectedPositionMarker.material.dispose();

        selectedPositionMarker = null;
    }

    selectedMarker = null;
    activeObjectMarker = null;

    // Clear previous visualization
    clearTrajectories();

    riskHighlightGroup.clear();

    // Highlight both collision objects
    highlightCollisionObjects(
        event.object_1.object_id,
        event.object_2.object_id
    );

    // Draw trajectory of object A
    await showTrajectory(
        event.object_1.object_id
    );

    // Draw trajectory of object B WITHOUT
    // deleting the first trajectory
    await addTrajectory(
        event.object_2.object_id
    );

    // Calculate and display closest approach
    await showCollisionLocation(
        event.object_1.object_id,
        event.object_2.object_id
    );
});

    eventsContainer.appendChild(eventElement);
});
}