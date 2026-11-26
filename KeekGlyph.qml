import QtQuick
import QtQuick.Shapes

// The keek cursor glyph, drawn from its 28-unit source path at any size.
Item {
  id: root

  property color fill: "transparent"
  property color stroke: "#ffffff"
  // In the glyph's 28-unit box, so it scales with the glyph.
  property real strokeWidth: 3

  implicitWidth: 12
  implicitHeight: 12

  Shape {
    width: 28
    height: 28
    scale: root.width / 28
    transformOrigin: Item.TopLeft
    preferredRendererType: Shape.CurveRenderer

    ShapePath {
      fillColor: root.fill
      strokeColor: root.stroke
      strokeWidth: root.strokeWidth
      joinStyle: ShapePath.RoundJoin
      PathSvg { path: "M3 3 L24 11 Q17 17 11 24 Z" }
    }
  }
}
