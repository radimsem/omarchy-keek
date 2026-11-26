pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../lib/Model.js" as Model

BarWidget {
  id: root
  moduleName: "radimsem.keek"

  readonly property string runtimeDir: Quickshell.env("XDG_RUNTIME_DIR") || ""
  readonly property string keekDir: runtimeDir !== "" ? runtimeDir + "/keek" : ""

  property var sessions: []
  property var previousWorkspace: null
  property var shownBinds: Model.bindsShown(null)
  property bool keekDirExists: false
  property bool popupWanted: false

  readonly property bool shown: sessions.length > 0
  readonly property var focusedWorkspace: Hyprland.focusedWorkspace
  readonly property string focusedName: focusedWorkspace ? String(focusedWorkspace.name || "") : ""
  readonly property int focusedId: focusedWorkspace ? focusedWorkspace.id : 0
  readonly property bool onKeek: focusedName === "keek"
  readonly property string buttonState: Model.buttonState(sessions, onKeek)
  readonly property bool needs: buttonState === "needs"
  readonly property bool inert: buttonState === "takeover"
  readonly property var dots: Model.dots(sessions)

  readonly property color barForeground: bar ? bar.barForeground : Commons.Color.foreground
  readonly property color foreground: needs ? "#0f2d42" : barForeground
  readonly property color pillColor: needs ? "#fba35e"
    : Util.alpha(barForeground, buttonState === "idle" ? 0.07 : 0.16)

  visible: shown
  implicitWidth: shown ? button.implicitWidth : 0
  implicitHeight: barSize

  function run(dispatches) {
    if (dispatches.length === 0) return
    var command = dispatches.map(function(lua) { return "hyprctl dispatch " + Util.shellQuote(lua) }).join(" && ")
    if (root.bar && typeof root.bar.run === "function") root.bar.run(command)
    else Quickshell.execDetached(["bash", "-c", command])
  }

  function activate() {
    root.popupWanted = false
    root.run(Model.buttonDispatches(root.sessions, root.onKeek, root.previousWorkspace))
  }

  function showSession(n) {
    root.popupWanted = false
    root.run(Model.rowDispatches(root.sessions, n))
  }

  function close() { root.popupWanted = false }

  function hoverChanged() {
    if (button.tooltipHovered) {
      hideTimer.stop()
      if (!root.popupWanted) showTimer.restart()
    } else {
      showTimer.stop()
      hideTimer.restart()
    }
  }

  // A focus change covers workspace switches and moves between monitors alike;
  // a workspace can also get its name after it gains focus. This reads the live
  // workspace, since the id and name properties above update one at a time.
  function recordFocused() {
    var focused = Hyprland.focusedWorkspace
    if (focused) root.previousWorkspace = Model.recordWorkspace(root.previousWorkspace, focused.id, String(focused.name || ""))
  }

  onFocusedIdChanged: recordFocused()
  onFocusedNameChanged: recordFocused()

  Component.onCompleted: {
    recordFocused()
    bindsProc.running = true
  }

  // A watch on bar.json only takes while its folder exists. The runtime folder
  // starts empty at each login, usually before keek first runs, so this view
  // waits for the folder and then sets the file's watch up again.
  FileView {
    id: keekFolder
    path: root.keekDir
    watchChanges: !root.keekDirExists
    printErrors: false
    onFileChanged: reload()
    onLoadFailed: function(error) {
      var exists = error === FileViewError.NotAFile
      if (exists && !root.keekDirExists) {
        barFile.path = ""
        barFile.path = root.keekDir + "/bar.json"
      }
      root.keekDirExists = exists
    }
  }

  FileView {
    id: barFile
    path: root.keekDir !== "" ? root.keekDir + "/bar.json" : ""
    watchChanges: true
    printErrors: false
    onFileChanged: reload()
    onLoaded: root.sessions = Model.parseBarState(barFile.text())
    onLoadFailed: root.sessions = []
  }

  Process {
    id: bindsProc
    command: ["hyprctl", "binds", "-j"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.shownBinds = Model.bindsShown(Model.parseJson(text))
    }
  }

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      if (event && String(event.name) === "configreloaded") bindsProc.running = true
    }
  }

  onShownChanged: if (!shown) root.popupWanted = false

  Timer {
    id: showTimer
    interval: 300
    onTriggered: if (button.tooltipHovered) root.popupWanted = true
  }

  // The pointer gets this long to cross from the button to the list.
  Timer {
    id: hideTimer
    interval: 200
    onTriggered: if (!button.tooltipHovered && !popup.containsMouse) root.popupWanted = false
  }

  WidgetButton {
    id: button
    bar: root.bar
    anchors.centerIn: parent
    labelVisible: false
    hasVisualContent: root.shown
    pressable: !root.inert
    fixedWidth: root.vertical ? root.barSize : pill.width
    fixedHeight: root.vertical ? pill.height + Style.space(6) : root.barSize
    onTooltipHoveredChanged: root.hoverChanged()
    onPressed: function(mouseButton) { if (mouseButton === Qt.LeftButton) root.activate() }

    Accessible.role: Accessible.Button
    Accessible.name: Model.ariaLabel(root.buttonState, root.sessions.length)
    Accessible.onPressAction: root.activate()

    Rectangle {
      id: pill
      anchors.centerIn: parent
      width: root.vertical ? Math.max(16, root.barSize - Style.space(6)) : content.implicitWidth + Style.space(8) + Style.space(9)
      height: root.vertical ? content.implicitHeight + Style.space(16) : Math.max(16, root.barSize - Style.space(6))
      radius: Style.cornerRadius > 0 ? Style.space(6) : 0
      color: root.pillColor

      Behavior on color {
        ColorAnimation { duration: Style.duration(160) }
      }

      Grid {
        id: content
        anchors.centerIn: parent
        anchors.horizontalCenterOffset: root.vertical ? 0 : (Style.space(8) - Style.space(9)) / 2
        columns: root.vertical ? 1 : 3
        columnSpacing: Style.space(7)
        rowSpacing: Style.space(5)
        horizontalItemAlignment: Grid.AlignHCenter
        verticalItemAlignment: Grid.AlignVCenter
        scale: button.pressScale

        KeekGlyph {
          width: Style.space(12)
          height: Style.space(12)
          fill: root.buttonState === "idle" ? "transparent" : root.foreground
          stroke: root.foreground
        }

        Text {
          visible: root.needs && !root.vertical
          text: "Needs you"
          textFormat: Text.PlainText
          color: root.foreground
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.font.body
          font.bold: true
          renderType: Text.NativeRendering
        }

        Grid {
          columns: root.vertical ? 1 : Math.max(1, root.dots.length)
          spacing: Style.space(1)

          Repeater {
            model: root.dots

            // The canvas draws a 7 px dot with a 1.5 px ring outside it.
            Rectangle {
              required property var modelData
              width: Style.space(10)
              height: width
              radius: width / 2
              color: modelData.ended ? "transparent" : modelData.color
              border.width: Style.spaceReal(1.5)
              border.color: modelData.ended ? modelData.color
                : (root.needs && modelData.waiting ? "#ffffff" : root.foreground)
            }
          }
        }
      }
    }
  }

  // Hover coordination stays out of the bar's popout registry: a hover list
  // must never close another widget's open panel.
  QtObject {
    id: popupBar
    readonly property string position: root.bar ? root.bar.position : "top"
    readonly property int barSize: root.barSize
    property var activePopout: null
    function barSizeFor(name) {
      return root.bar && typeof root.bar.barSizeFor === "function" ? root.bar.barSizeFor(name) : root.barSize
    }
    function requestPopout(owner) {}
    function releasePopout(owner) {}
  }

  KeekPopup {
    id: popup
    anchorItem: button
    bar: popupBar
    owner: root
    open: root.popupWanted && root.shown
    sessions: root.sessions
    buttonState: root.buttonState
    shownBinds: root.shownBinds
    onKeek: root.onKeek
    previousWorkspace: root.previousWorkspace
    fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
    onContainsMouseChanged: {
      if (containsMouse) hideTimer.stop()
      else hideTimer.restart()
    }
    onSessionClicked: function(n) { root.showSession(n) }
  }
}
