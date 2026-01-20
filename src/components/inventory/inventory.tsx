import { Slot, component$, $, useOnDocument, QRL, useStore, useSignal } from "@builder.io/qwik";
import { ActionHandler, KEY_TO_ACTION_MAP, MoveDirection, useFSM } from "~/utils/FSM";


const COLS = 8;
const ROWS = 8;
export default component$(() => {
    const currentPos = useStore({x: 0, y: 0});
    const lastDirection = useSignal<MoveDirection | ''>('');

    const slots = useSignal<{item?: { count: number; id: string; }, index: number }[]>(
        Array.from({length: 64}, (_, i) => {
            const item = Math.random() > 0.5 ? {
                count: Math.ceil(Math.random() * 20),
                id: Array.from({length: 3}, () => getChar()).join(""),
            } : undefined;
            return {
                item,
                index: i,
            };
        })
    );

    const onAction: QRL<ActionHandler> = $((action) => {
        console.log(action);
        switch(action.type) {
            case "MOVE": {
                const movements = KEY_TO_ACTION_MAP[action.type];
                const letterKey = action.key!.match(/\D+/)![0];
                const letterKeyLowerCase = letterKey.toLowerCase() as keyof typeof movements;

                const isUpperCase = letterKey === letterKey.toUpperCase();
                const count = Number(action.key!.match(/\d+/)?.[0] ?? '1');
                const multiplier = ((letterKeyLowerCase === 'b' || letterKeyLowerCase === 'w') 
                    ? (isUpperCase 
                        ? 3 
                        : 2) 
                    : 1
                );
                const modifiedCount = count * multiplier;


                const direction = movements[letterKeyLowerCase];
                console.log({direction, modifiedCount});
                switch (direction) {
                    case 'LEFT':
                        currentPos.x = Math.max(0, currentPos.x - modifiedCount);
                        break;
                    case 'RIGHT':
                        currentPos.x = Math.min(COLS - 1, currentPos.x + modifiedCount);
                        break;
                    case 'UP':
                        currentPos.y = Math.max(0, currentPos.y - modifiedCount);
                        break;
                    case 'DOWN':
                        currentPos.y = Math.min(ROWS - 1, currentPos.y + modifiedCount);
                        break;
                }
                lastDirection.value = direction;
                break;
            }

            case "INTERACT": {

                break;
            }

            case "TARGET": {
                const movements = KEY_TO_ACTION_MAP[action.type];
                const [letterKey, target] = action.command!.match(/\D./)![0];
                const direction = movements[letterKey as 'f' | 'F'];
                console.log({letterKey, target, direction});
                const row = slots.value.slice(currentPos.y * COLS, (currentPos.y + 1) * COLS);
                switch(direction) {
                    case 'LEFT': {
                        const partialRow = row.slice(0, currentPos.x).reverse();
                        const ids = partialRow.map(
                            ({item}) => item?.id?.split('').reverse().join('')
                        ).join(',');
                        const pos = ids.indexOf(target);

                        if (pos === -1) break;

                        const preString = ids.slice(0, pos).split(',');
                        currentPos.x = Math.max(0, currentPos.x - preString.length);

                        break;
                    }

                    case 'RIGHT': {
                        const partialRow = row.slice(currentPos.x + 1);
                        const ids = partialRow.map(({item}) => item?.id).join(',');
                        const pos = ids.indexOf(target);

                        if (pos === -1) break;

                        const preString = ids.slice(0, pos).split(',');
                        currentPos.x = Math.min(COLS - 1, currentPos.x + preString.length);

                        break;
                    }
                }
                break;
            }

            case "COMMAND": {
                break;
            }

        }
    });
    const fsm = useFSM(onAction);

    useOnDocument('keydown', $((event) => {
        fsm?.keyPress(event);
    }));


    return (
        <section
            class="p-4 w-224 bg-amber-900/60 rounded-md flex flex-col"
        >
            <h1>Inventory</h1>
            <div
                class={`grid grid-cols-8 gap-2`}
            >
                {slots.value.map(({item, index}) => {
                    const row = Math.floor(index / COLS);
                    const col = index % COLS;
                    return (
                        <ItemSlot
                            key={index}
                            currentPos={currentPos}
                            index={index}
                            row={row}
                            col={col}
                        >
                            {item 
                                ? (<Item
                                    id={item.id}
                                    count={item.count}
                                    row={row}
                                    col={col}
                                />) 
                                : null}
                        </ItemSlot>
                    );
                    
                })}
                
            </div>
        </section>
    )
});

type ItemSlotProps = {
    index: number;
    currentPos: {
        x: number;
        y: number;
    };
    row: number;
    col: number;
};
const ItemSlot = component$<ItemSlotProps>(({ index, currentPos, row, col }) => {
    return (
        <div
            class={`relative border ${currentPos.x === col && currentPos.y === row ? 'border-green-300' : 'border-gray-200'} rounded w-24 h-24 bg-gray-800 grid place-items-center grid-rows-3`}
            data-col={col}
            data-row={row}
        >
            <ItemIndex index={index} />
            <Slot />
        </div>
    );
});


const ItemIndex = ({index}: {index: number}) => <span class="pr-0.5 text-gray-300 col-start-2 z-1 justify-self-end">{index}</span>

type ItemProps = {
    id: string;
    count: number;
    row: number;
    col: number;
};
function Item({ id, count, row, col }: ItemProps) {
    return (
        <div
            class="absolute top-0 left-0 border border-gray-200 rounded w-23.5 h-23.5 bg-gray-800 grid place-items-center grid-rows-3 grid-cols-2"
            data-col={col}
            data-row={row}
        >
            <code class="justify-self-start pl-0.5">{id}</code>
            <span class="col-span-2">Item</span>
            <span>{count}</span>
        </div>
    )
}

function getChar(code?: string) {
    if (code && BASE_58_ALPHABET.includes(code)) return code;
    const index =  Math.floor(Math.random() * BASE_58_ALPHABET.length);
    return BASE_58_ALPHABET[index];
}

const BASE_58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".split("");
