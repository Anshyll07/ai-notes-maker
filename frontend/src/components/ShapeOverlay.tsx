import { useState } from 'react';
import Draggable from 'react-draggable';

interface Shape {
    id: string;
    type: 'box' | 'circle';
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    opacity: number;
}

interface ShapeOverlayProps {
    shapes: Shape[];
    onUpdateShapes: (shapes: Shape[]) => void;
}

const ShapeOverlay: React.FC<ShapeOverlayProps> = ({ shapes, onUpdateShapes }) => {
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

    const handleDrag = (id: string, data: any) => {
        const updatedShapes = shapes.map(shape =>
            shape.id === id ? { ...shape, x: data.x, y: data.y } : shape
        );
        onUpdateShapes(updatedShapes);
    };

    const handleColorChange = (id: string, color: string) => {
        const updatedShapes = shapes.map(shape =>
            shape.id === id ? { ...shape, color } : shape
        );
        onUpdateShapes(updatedShapes);
    };

    const handleOpacityChange = (id: string, opacity: number) => {
        const updatedShapes = shapes.map(shape =>
            shape.id === id ? { ...shape, opacity } : shape
        );
        onUpdateShapes(updatedShapes);
    };

    const handleDelete = (id: string) => {
        onUpdateShapes(shapes.filter(shape => shape.id !== id));
        setSelectedShapeId(null);
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-30">
            {shapes.map(shape => (
                <Draggable
                    key={shape.id}
                    position={{ x: shape.x, y: shape.y }}
                    onStop={(_, data) => handleDrag(shape.id, data)}
                >
                    <div
                        className="absolute pointer-events-auto cursor-move group"
                        onClick={() => setSelectedShapeId(shape.id)}
                        style={{
                            width: `${shape.width}px`,
                            height: `${shape.height}px`,
                        }}
                    >
                        {/* Shape */}
                        <div
                            className={`w-full h-full border-2 border-dashed ${selectedShapeId === shape.id ? 'border-blue-500' : 'border-transparent'
                                }`}
                            style={{
                                backgroundColor: shape.color,
                                opacity: shape.opacity,
                                borderRadius: shape.type === 'circle' ? '50%' : '8px',
                            }}
                        />

                        {/* Controls (visible on select) */}
                        {selectedShapeId === shape.id && (
                            <div className="absolute -top-12 left-0 bg-dark-800 border border-dark-600 rounded-lg p-2 flex items-center gap-2 shadow-xl pointer-events-auto">
                                <input
                                    type="color"
                                    value={shape.color}
                                    onChange={(e) => handleColorChange(shape.id, e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer"
                                    title="Shape Color"
                                />
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.1"
                                    value={shape.opacity}
                                    onChange={(e) => handleOpacityChange(shape.id, parseFloat(e.target.value))}
                                    className="w-20"
                                    title="Opacity"
                                />
                                <button
                                    onClick={() => handleDelete(shape.id)}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </Draggable>
            ))}
        </div>
    );
};

export default ShapeOverlay;
