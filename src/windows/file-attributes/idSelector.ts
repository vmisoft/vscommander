import { ComboBox } from '../../components/comboBox';

// A ComboBox over a name -> numeric-id map (e.g. /etc/passwd, /etc/group):
// pre-loaded with the sorted names and able to resolve the typed text back to
// an id. Where the map is empty it degrades to a plain input box.
// Base of UserDropdown / GroupDropdown.
export class IdSelector extends ComboBox {
    private readonly map: Map<string, number>;

    constructor(label: string, labelWidth: number, width: number,
                initialId: number, map: Map<string, number>) {
        super(label, labelWidth, width, IdSelector.nameForId(map, initialId),
            [...map.keys()].sort());
        this.map = map;
    }

    // Resolve the typed text to an id: a known name, else a parsed number,
    // else undefined (leave unchanged).
    resolvedId(): number | undefined {
        const trimmed = this.value.trim();
        if (this.map.has(trimmed)) {
            return this.map.get(trimmed);
        }
        const n = parseInt(trimmed, 10);
        return isNaN(n) ? undefined : n;
    }

    private static nameForId(map: Map<string, number>, id: number): string {
        for (const [name, value] of map) {
            if (value === id) return name;
        }
        return String(id);
    }
}
