import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Note } from '../App';

interface MentionListProps {
    items: Note[];
    command: (props: { id: string; label: string }) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command({ id: item.id, label: item.title });
        }
    };

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
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
        <div className="bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
            {props.items.length ? (
                props.items.map((item, index) => (
                    <button
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${index === selectedIndex ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-dark-700'
                            }`}
                        key={item.id}
                        onClick={() => selectItem(index)}
                    >
                        <span>{item.icon || '📝'}</span>
                        <span className="truncate">{item.title}</span>
                    </button>
                ))
            ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No notes found</div>
            )}
        </div>
    );
});

export default MentionList;
