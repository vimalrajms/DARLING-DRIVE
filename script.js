"use strict";

/* =========================================
   DARLING DRIVE
   Website Controller - Demo Mode
========================================= */

const CONFIG = {
    pairCode: "VIMAL MS",

    // Demo mode: website UI only.
    // Actual ESP32 connection is NOT enabled yet.
    demoMode: true,

    // Configure this later when ESP32 firmware
    // and its control API are ready.
    esp32BaseUrl: "",

    // Safety timeout for a held control.
    controlTimeoutMs: 500,

    // Demo dashboard maximum display value.
    demoMaxSpeed: 100
};

const state = {
    paired: false,
    connected: false,
    activeCommand: "stop",
    direction: "STOP",
    speed: 0,
    activeButton: null,
    controlTimer: null,
    commandSequence: 0
};

const elements = {
    app: document.getElementById("darlingApp"),

    connectionDot: document.getElementById("connectionDot"),
    connectionText: document.getElementById("connectionText"),

    carStatus: document.getElementById("carStatus"),

    pairForm: document.getElementById("pairForm"),
    pairCode: document.getElementById("pairCode"),
    pairButton: document.getElementById("pairButton"),
    pairBadge: document.getElementById("pairBadge"),
    pairMessage: document.getElementById("pairMessage"),

    controlButtons: document.querySelectorAll("[data-command]"),

    speedValue: document.getElementById("speedValue"),
    directionDisplay: document.getElementById("directionDisplay"),

    controlStatus: document.getElementById("controlStatus"),
    steeringStatus: document.getElementById("steeringStatus"),

    emergencyStop: document.getElementById("emergencyStop"),
    controlNotice: document.getElementById("controlNotice")
};


/* =========================================
   INITIAL SETUP
========================================= */

function init() {
    setConnectionStatus(false);
    setPairedUI(false);
    setSpeed(0);
    setDirection("STOP");
    setControlStatus("Enter your pairing code to unlock the controls.");

    if (elements.pairCode) {
        elements.pairCode.setAttribute("autocomplete", "off");
        elements.pairCode.setAttribute("spellcheck", "false");
        elements.pairCode.setAttribute("autocapitalize", "characters");
    }

    setupPairing();
    setupControls();
    setupEmergencyStop();
    setupKeyboardControls();
    setupPageSafety();

    if (elements.controlNotice) {
        elements.controlNotice.textContent =
            "Demo mode: controls update this website only. ESP32 motor control is not connected.";
    }

    console.log("DARLING DRIVE initialized in demo mode.");
}


/* =========================================
   PAIRING
========================================= */

function setupPairing() {
    if (!elements.pairForm) {
        console.warn("Pair form not found. Check index.html IDs.");
        return;
    }

    elements.pairForm.addEventListener("submit", function (event) {
        event.preventDefault();
        attemptPairing();
    });
}

function attemptPairing() {
    if (!elements.pairCode) {
        return;
    }

    const enteredCode = elements.pairCode.value.trim();

    if (!enteredCode) {
        showPairMessage("Please enter your pairing code.", "error");
        elements.pairCode.focus();
        return;
    }

    // This check is only a local demo check.
    // It is NOT secure device authentication.
    if (enteredCode.toUpperCase() !== CONFIG.pairCode.toUpperCase()) {
        setPairedUI(false);
        showPairMessage("Incorrect pairing code. Please try again.", "error");
        stopAllControls("Pairing failed");
        return;
    }

    state.paired = true;

    setPairedUI(true);

    showPairMessage(
        "Code accepted! Website demo controls are unlocked. ESP32 is not connected.",
        "success"
    );

    setConnectionStatus(false);

    setControlStatus("Demo controls ready. No real motor commands are being sent.");

    if (elements.carStatus) {
        elements.carStatus.textContent = "DEMO MODE — ESP32 NOT CONNECTED";
    }

    elements.pairCode.value = "";

    console.log("Pair code accepted in local demo mode.");
}

function setPairedUI(isPaired) {
    state.paired = isPaired;

    elements.controlButtons.forEach(function (button) {
        button.disabled = !isPaired;
        button.setAttribute("aria-disabled", String(!isPaired));
    });

    if (elements.pairBadge) {
        elements.pairBadge.textContent = isPaired
            ? "✓ CODE ACCEPTED — DEMO"
            : "🔒 NOT PAIRED";
    }

    if (elements.pairButton) {
        elements.pairButton.textContent = isPaired
            ? "PAIRED"
            : "PAIR DEVICE";
    }

    if (!isPaired) {
        setSpeed(0);
        setDirection("STOP");
    }
}

function showPairMessage(message, type) {
    if (!elements.pairMessage) {
        return;
    }

    elements.pairMessage.textContent = message;
    elements.pairMessage.classList.remove("success", "error");

    if (type) {
        elements.pairMessage.classList.add(type);
    }
}


/* =========================================
   CONNECTION STATUS
========================================= */

function setConnectionStatus(isConnected) {
    state.connected = isConnected;

    if (elements.connectionDot) {
        elements.connectionDot.classList.toggle("connected", isConnected);
    }

    if (elements.connectionText) {
        elements.connectionText.textContent = isConnected
            ? "DEVICE CONNECTED"
            : "ESP32 OFFLINE";
    }
}


/* =========================================
   CONTROLLER BUTTONS
========================================= */

function setupControls() {
    elements.controlButtons.forEach(function (button) {
        const command = button.dataset.command;

        if (!command) {
            return;
        }

        button.addEventListener("pointerdown", function (event) {
            if (!state.paired || button.disabled) {
                return;
            }

            event.preventDefault();

            try {
                button.setPointerCapture(event.pointerId);
            } catch (error) {
                // Pointer capture may not be supported
                // in every browser or input context.
            }

            startControl(command, button);
        });

        button.addEventListener("pointerup", function () {
            if (state.activeButton === button) {
                stopAllControls("Control released");
            }
        });

        button.addEventListener("pointercancel", function () {
            if (state.activeButton === button) {
                stopAllControls("Touch cancelled");
            }
        });

        button.addEventListener("lostpointercapture", function () {
            if (state.activeButton === button) {
                stopAllControls("Control released");
            }
        });

        button.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });

        // Prevent browser drag behaviour.
        button.addEventListener("dragstart", function (event) {
            event.preventDefault();
        });
    });
}

function startControl(command, button) {
    if (!state.paired) {
        return;
    }

    clearControlTimer();

    if (state.activeButton && state.activeButton !== button) {
        state.activeButton.classList.remove("active");
    }

    state.activeButton = button;
    state.activeCommand = command;

    button.classList.add("active");

    setDirection(command.toUpperCase());

    if (command === "left" || command === "right") {
        updateSteeringAnimation(command);
        setControlStatus("Steering control active — demo only.");
    } else if (command === "forward") {
        setControlStatus("Forward selected — demo only.");
        setSpeed(CONFIG.demoMaxSpeed);
    } else if (command === "reverse") {
        setControlStatus("Reverse selected — demo only.");
        setSpeed(Math.round(CONFIG.demoMaxSpeed / 2));
    }

    sendCommand(command);

    // If a release event is missed, clear the visual
    // command state after a short timeout.
    state.controlTimer = window.setTimeout(function () {
        stopAllControls("Control timeout");
    }, CONFIG.controlTimeoutMs);
}

function stopAllControls(reason) {
    clearControlTimer();

    if (state.activeButton) {
        state.activeButton.classList.remove("active");
        state.activeButton = null;
    }

    elements.controlButtons.forEach(function (button) {
        button.classList.remove("active");
    });

    state.activeCommand = "stop";

    updateSteeringAnimation("stop");
    setSpeed(0);
    setDirection("STOP");

    if (reason) {
        setControlStatus(reason + ". Demo controls stopped.");
    }

    sendCommand("stop");
}

function clearControlTimer() {
    if (state.controlTimer !== null) {
        window.clearTimeout(state.controlTimer);
        state.controlTimer = null;
    }
}


/* =========================================
   EMERGENCY STOP
========================================= */

function setupEmergencyStop() {
    if (!elements.emergencyStop) {
        return;
    }

    elements.emergencyStop.addEventListener("click", function () {
        stopAllControls("Emergency STOP activated");

        showPairMessage(
            state.paired
                ? "Demo controls stopped. No ESP32 motor command was sent."
                : "Emergency STOP selected. Pairing is still required to unlock controls.",
            state.paired ? "success" : "error"
        );

        console.warn("Emergency STOP selected in website demo mode.");
    });
}


/* =========================================
   DASHBOARD UPDATES
========================================= */

function setSpeed(value) {
    const safeValue = Math.max(
        0,
        Math.min(CONFIG.demoMaxSpeed, Number(value) || 0)
    );

    state.speed = safeValue;

    if (elements.speedValue) {
        elements.speedValue.textContent = String(safeValue);
    }
}

function setDirection(direction) {
    state.direction = direction;

    if (elements.directionDisplay) {
        elements.directionDisplay.textContent = direction;
    }
}

function setControlStatus(message) {
    if (elements.controlStatus) {
        elements.controlStatus.textContent = message;
    }

    if (elements.steeringStatus) {
        elements.steeringStatus.textContent = message;
    }
}

function updateSteeringAnimation(direction) {
    const dashboardCar = document.querySelector(".dashboard-car");

    if (!dashboardCar) {
        return;
    }

    dashboardCar.classList.remove("turn-left", "turn-right");

    if (direction === "left") {
        dashboardCar.classList.add("turn-left");
    } else if (direction === "right") {
        dashboardCar.classList.add("turn-right");
    }
}


/* =========================================
   COMMAND HANDLER
========================================= */

function sendCommand(command) {
    state.commandSequence += 1;

    const commandInfo = {
        command: command,
        sequence: state.commandSequence,
        demo: CONFIG.demoMode,
        timestamp: new Date().toISOString()
    };

    // Demo mode deliberately does not send network requests.
    if (CONFIG.demoMode) {
        console.log("[DARLING DRIVE DEMO]", commandInfo);
        return;
    }

    // The actual ESP32 transport will be added only
    // after the ESP32 server/API is implemented and tested.
    console.warn(
        "ESP32 transport is not implemented. Command was not sent:",
        commandInfo
    );
}


/* =========================================
   OPTIONAL KEYBOARD CONTROLS
========================================= */

function setupKeyboardControls() {
    const keyCommands = {
        ArrowUp: "forward",
        ArrowDown: "reverse",
        ArrowLeft: "left",
        ArrowRight: "right"
    };

    const heldKeys = new Set();

    window.addEventListener("keydown", function (event) {
        if (!state.paired || event.repeat) {
            return;
        }

        if (event.target instanceof HTMLInputElement) {
            return;
        }

        const command = keyCommands[event.key];

        if (!command) {
            return;
        }

        event.preventDefault();
        heldKeys.add(event.key);

        const button = document.querySelector(
            '[data-command="' + command + '"]'
        );

        if (button && !button.disabled) {
            startControl(command, button);
        }
    });

    window.addEventListener("keyup", function (event) {
        if (heldKeys.has(event.key)) {
            heldKeys.delete(event.key);
            stopAllControls("Keyboard control released");
        }
    });

    window.addEventListener("blur", function () {
        heldKeys.clear();
        stopAllControls("Window lost focus");
    });
}


/* =========================================
   PAGE SAFETY
========================================= */

function setupPageSafety() {
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            stopAllControls("Page hidden");
        }
    });

    window.addEventListener("pagehide", function () {
        stopAllControls("Page closed");
    });

    window.addEventListener("blur", function () {
        stopAllControls("Window inactive");
    });
}


/* =========================================
   START APP
========================================= */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}