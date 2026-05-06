export class Utils {
    static get_key_info(key) {
        const key_map = {
            Backspace: ['Backspace', 8],
            Tab: ['Tab', 9],
            Enter: ['Enter', 13],
            Escape: ['Escape', 27],
            Space: ['Space', 32],
            ArrowLeft: ['ArrowLeft', 37],
            ArrowUp: ['ArrowUp', 38],
            ArrowRight: ['ArrowRight', 39],
            ArrowDown: ['ArrowDown', 40],
            Delete: ['Delete', 46],
            Shift: ['ShiftLeft', 16],
            Control: ['ControlLeft', 17],
            Alt: ['AltLeft', 18],
            Meta: ['MetaLeft', 91],
        };
        const direct = key_map[key];
        if (direct) {
            return direct;
        }
        if (key.length === 1) {
            if (/[a-z]/i.test(key)) {
                const upper = key.toUpperCase();
                return [`Key${upper}`, upper.charCodeAt(0)];
            }
            if (/[0-9]/.test(key)) {
                return [`Digit${key}`, key.charCodeAt(0)];
            }
        }
        return [key, null];
    }
}
export const get_key_info = (key) => Utils.get_key_info(key);
