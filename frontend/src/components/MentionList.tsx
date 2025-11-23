import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

export default forwardRef((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index) => {
        const item = props.items[index];

        if (item) {
            props.command({ id: item.filename, label: item.filename });
        }
    };

    const upHandler = () => {
        setSelectedIndex(((selectedIndex + props.items.length) - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }

            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }

            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }

            return false;
        },
    }));

    return (
        <div className="bg-dark-800 border border-dark-700 rounded-lg shadow-xl p-2">
            {props.items.length ? (
                props.items.map((item, index) => (
                    <button
                        className={`w-full text-left p-2 rounded-md text-sm ${index === selectedIndex ? 'bg-dark-700' : ''}`}
                        key={index}
                        onClick={() => selectItem(index)}
                    >
                        {item.filename}
                    </button>
                ))
            ) : (
                <div className="p-2 text-sm text-gray-500">No result</div>
            )}
        </div>
    );
});
