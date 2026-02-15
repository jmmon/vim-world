const _BASE_58_CHARSET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
let _base58Map: ReturnType<typeof create_base58_map>;
/**
 * Generates a mapping between base58 and ascii.
 */
const create_base58_map = () => {
  const base58M = Array(256).fill(-1);
  for (let i = 0; i < _BASE_58_CHARSET.length; ++i)
    base58M[_BASE_58_CHARSET.charCodeAt(i)] = i;

  return base58M;
};
const getBase58Map = () => {
    if (!_base58Map) _base58Map = create_base58_map();
    return _base58Map;
}
const base58Map = getBase58Map();

function binary_to_base58(uint8array: Uint8Array) {
  const result = [];

  for (const byte of uint8array) {
    let carry = byte;
    for (let j = 0; j < result.length; ++j) {
      const x: number = (base58Map[result[j]] << 8) + carry;
      result[j] = _BASE_58_CHARSET.charCodeAt(x % 58);
      carry = (x / 58) | 0;
    }
    while (carry) {
      result.push(_BASE_58_CHARSET.charCodeAt(carry % 58));
      carry = (carry / 58) | 0;
    }
  }

  for (const byte of uint8array)
    if (byte) break;
    else result.push("1".charCodeAt(0));

  result.reverse();

  return String.fromCharCode(...result);
}

function numberToBytes(bigint: bigint) {
  const size = Math.ceil((bigint.toString(2).length + 7) / 8); // bytes needed
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    bytes[i] = Number((bigint >> BigInt(i * 8)) & BigInt(0xff));
  }
  return bytes;
}

export function base58(number: bigint) {
    return binary_to_base58(numberToBytes(number));
}

