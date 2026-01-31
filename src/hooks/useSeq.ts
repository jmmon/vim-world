import { $, useSignal } from "@builder.io/qwik";

function useSeq() {
    const seq = useSignal(0);

    return $(() => {
        const thisSeq = seq.value;
        seq.value++;
        return thisSeq;
    });
}
export default useSeq;


