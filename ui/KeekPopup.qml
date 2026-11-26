pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "../lib/Model.js" as Model

PopupCard {
  id: root

  property var sessions: []
  property string buttonState: "idle"
  property var shownBinds: null
  property bool onKeek: false
  property var previousWorkspace: null
  property string fontFamily: Style.font.family
  property real now: Date.now()

  readonly property bool inert: buttonState === "takeover"
  readonly property color textColor: Commons.Color.popups.text
  readonly property color muted: Util.alpha(textColor, 0.75)
  readonly property color keyEdge: Util.alpha(textColor, 0.4)

  signal sessionClicked(int n)

  triggerMode: "hover"
  padding: Style.space(16)
  contentWidth: root.fittedContentWidth(Style.space(560))
  contentHeight: root.fittedContentHeight(column.implicitHeight)

  // Counts elapsed time only while the list is on screen. A property, since
  // the card's default property takes only Items.
  property Timer clock: Timer {
    interval: 1000
    repeat: true
    triggeredOnStart: true
    running: root.visible
    onTriggered: root.now = Date.now()
  }

  component KeyCap: Rectangle {
    property alias label: capText.text
    implicitWidth: capText.implicitWidth + Style.space(12)
    implicitHeight: capText.implicitHeight + Style.space(4)
    radius: Style.space(4)
    color: "transparent"
    border.width: 1
    border.color: root.keyEdge

    Text {
      id: capText
      anchors.centerIn: parent
      textFormat: Text.PlainText
      color: root.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
    }
  }

  Column {
    id: column
    width: parent.width
    spacing: Style.space(12)
    // The card is a window, which takes no Accessible properties, so its content names it.
    Accessible.role: Accessible.Dialog
    Accessible.name: "keek sessions"

    Item {
      width: parent.width
      implicitHeight: Math.max(header.implicitHeight, launchKeys.implicitHeight)

      Row {
        id: header
        anchors.left: parent.left
        anchors.leftMargin: Style.space(4)
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.space(10)

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: "keek"
          textFormat: Text.PlainText
          color: root.textColor
          font.family: root.fontFamily
          font.pixelSize: Style.font.subtitle
          font.bold: true
        }

        Text {
          anchors.verticalCenter: parent.verticalCenter
          text: Model.sessionCount(root.sessions.length)
          textFormat: Text.PlainText
          color: root.muted
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
        }
      }

      Row {
        id: launchKeys
        visible: !!root.shownBinds && root.shownBinds.launch
        anchors.right: parent.right
        anchors.rightMargin: Style.space(4)
        anchors.verticalCenter: parent.verticalCenter
        spacing: Style.space(4)

        KeyCap { label: "Super" }
        KeyCap { label: "Shift" }
        KeyCap { label: "K" }
      }
    }

    Column {
      width: parent.width
      spacing: Style.space(8)

      Repeater {
        model: root.sessions

        Rectangle {
          id: row
          required property var modelData
          readonly property bool needs: modelData.state === "needs_you"
          readonly property var ticks: Model.ticks(modelData.checks, modelData.state)

          width: parent.width
          implicitHeight: rowColumn.implicitHeight + Style.space(24)
          radius: Style.space(6)
          color: Util.alpha(root.textColor, rowMouse.containsMouse && !root.inert ? 0.08 : (needs ? 0.06 : 0.03))
          border.width: 1
          border.color: needs ? "#fba35e" : Util.alpha(Commons.Color.popups.border, 0.35)
          opacity: root.inert ? 0.45 : 1

          Accessible.role: Accessible.Button
          Accessible.name: "Show " + modelData.project
          Accessible.onPressAction: if (!root.inert) root.sessionClicked(modelData.n)

          Column {
            id: rowColumn
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.leftMargin: Style.space(14)
            anchors.rightMargin: Style.space(14)
            spacing: Style.space(9)

            Item {
              width: parent.width
              implicitHeight: Math.max(project.implicitHeight, elapsedText.implicitHeight)

              KeekGlyph {
                id: rowGlyph
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                width: Style.space(12)
                height: Style.space(12)
                fill: row.modelData.color
                stroke: "#ffffff"
                strokeWidth: 2.6
              }

              Text {
                id: project
                anchors.left: rowGlyph.right
                anchors.leftMargin: Style.space(10)
                anchors.verticalCenter: parent.verticalCenter
                text: row.modelData.project
                textFormat: Text.PlainText
                color: root.textColor
                font.family: root.fontFamily
                font.pixelSize: Style.font.subtitle
                font.bold: true
              }

              Text {
                anchors.left: project.right
                anchors.leftMargin: Style.space(10)
                anchors.right: elapsedText.left
                anchors.rightMargin: Style.space(10)
                anchors.verticalCenter: parent.verticalCenter
                text: row.modelData.branch
                textFormat: Text.PlainText
                elide: Text.ElideRight
                color: root.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
              }

              // keek publishes no end time, so an ended session shows no clock.
              Text {
                id: elapsedText
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                text: row.modelData.state === "ended" ? "" : Model.elapsed(row.modelData.openedAt, root.now)
                textFormat: Text.PlainText
                color: root.textColor
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                font.bold: true
              }
            }

            Row {
              width: parent.width
              spacing: Style.space(8)

              Text {
                id: needsLabel
                visible: row.needs
                text: "Needs you"
                textFormat: Text.PlainText
                color: "#fba35e"
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                font.bold: true
              }

              Text {
                width: parent.width - (needsLabel.visible ? needsLabel.width + parent.spacing : 0)
                text: row.modelData.detail
                textFormat: Text.PlainText
                elide: Text.ElideRight
                color: row.needs ? root.textColor : root.muted
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
              }
            }

            Item {
              width: parent.width
              implicitHeight: Math.max(marks.implicitHeight, rowKeys.implicitHeight, focusPill.implicitHeight)

              Row {
                id: marks
                visible: row.modelData.checks.length > 0
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(10)

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  text: Model.checksMarked(row.modelData.checks) + " of " + row.modelData.checks.length
                  textFormat: Text.PlainText
                  color: root.textColor
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                  font.bold: true
                }

                Row {
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(4)
                  Accessible.role: Accessible.Graphic
                  Accessible.name: Model.checksMarked(row.modelData.checks) + " of " + row.modelData.checks.length + " Checks marked"

                  Repeater {
                    model: row.ticks

                    Rectangle {
                      required property var modelData
                      readonly property color markColor: modelData.mark === "p" ? "#a9c972"
                        : modelData.mark === "f" ? "#ff8e7c"
                        : modelData.mark === "s" ? "#ebcf70" : root.keyEdge
                      width: Style.space(10)
                      height: width
                      radius: Style.space(2)
                      color: modelData.mark === "p" || modelData.mark === "f" ? markColor : "transparent"
                      border.width: 1
                      border.color: markColor

                      Rectangle {
                        visible: parent.modelData.current
                        anchors.centerIn: parent
                        width: Style.spaceReal(3.2)
                        height: width
                        radius: width / 2
                        color: "#77baf3"
                      }
                    }
                  }
                }
              }

              Row {
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(10)

                Rectangle {
                  id: focusPill
                  visible: row.modelData.inFocus
                  anchors.verticalCenter: parent.verticalCenter
                  implicitWidth: focusText.implicitWidth + Style.space(14)
                  implicitHeight: focusText.implicitHeight + Style.space(2)
                  width: implicitWidth
                  height: implicitHeight
                  radius: height / 2
                  color: "transparent"
                  border.width: 1
                  border.color: Qt.rgba(119 / 255, 186 / 255, 243 / 255, 0.65)

                  Text {
                    id: focusText
                    anchors.centerIn: parent
                    text: "in focus"
                    textFormat: Text.PlainText
                    color: "#bcdcff"
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }

                Row {
                  id: rowKeys
                  visible: Model.rowShowsKey(root.shownBinds, row.modelData.n, root.onKeek)
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(4)

                  KeyCap { label: "Super" }
                  KeyCap { label: "F" + row.modelData.n }
                }
              }
            }
          }

          MouseArea {
            id: rowMouse
            anchors.fill: parent
            enabled: !root.inert
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.sessionClicked(row.modelData.n)
          }
        }
      }
    }

    Text {
      width: parent.width - Style.space(8)
      x: Style.space(4)
      text: Model.footerText(root.buttonState, root.previousWorkspace)
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      lineHeight: 1.6
      color: root.muted
      font.family: root.fontFamily
      font.pixelSize: Style.font.body
    }
  }
}
