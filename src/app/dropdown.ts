
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

export interface DropdownItem<T extends string = string> {
    value: T;
    label: string;
}

export interface DropdownHandle {
    get_value(): string;
    destroy(): void;
}

export function dropdown_create<T extends string>(
    host: HTMLElement,
    items: DropdownItem<T>[],
    initial: T,
    on_change: (value: T) => void,
): DropdownHandle {
    let value: T = initial;
    let is_open = false;

    const root = document.createElement("div");
    root.className = "dd";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dd_trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const trigger_label = document.createElement("span");
    trigger_label.className = "dd_value";

    const chevron = document.createElement("i");
    chevron.setAttribute("data-lucide", "chevron-down");
    chevron.setAttribute("aria-hidden", "true");

    trigger.append(trigger_label, chevron);

    const menu = document.createElement("ul");
    menu.className = "dd_menu";
    menu.setAttribute("role", "listbox");

    const nodes = items.map((item) => {
        const li = document.createElement("li");
        li.className = "dd_item";
        li.setAttribute("role", "option");
        li.textContent = item.label;
        li.dataset.value = item.value;
        menu.appendChild(li);
        return { item, el: li };
    });

    function sync(): void {
        const current = nodes.find((n) => n.item.value === value);
        trigger_label.textContent = current ? current.item.label : "";
        for (const n of nodes) {
            const active = n.item.value === value;
            n.el.classList.toggle("is_active", active);
            n.el.setAttribute("aria-selected", active ? "true" : "false");
        }
        trigger.setAttribute("aria-expanded", is_open ? "true" : "false");
    }

    function open(): void {
        if (is_open) return;
        is_open = true;
        root.classList.add("is_open");
        sync();
    }

    function close(): void {
        if (!is_open) return;
        is_open = false;
        root.classList.remove("is_open");
        sync();
    }

    function toggle(): void {
        if (is_open) close();
        else open();
    }

    function pick(next: T): void {
        const changed = next !== value;
        value = next;
        sync();
        close();
        if (changed) on_change(value);
    }

    function on_doc_pointer(event: PointerEvent): void {
        if (!root.contains(event.target as Node)) close();
    }

    function on_keydown(event: KeyboardEvent): void {
        if (event.key === "Escape") {
            close();
            trigger.focus();
            return;
        }
        if (!is_open) return;
        const index = nodes.findIndex((n) => n.item.value === value);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            const next_index = Math.min(nodes.length - 1, Math.max(0, index + step));
            pick(nodes[next_index].item.value);
            sync();
            open();
            return;
        }
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            close();
        }
    }

    root.append(trigger, menu);
    host.appendChild(root);

    trigger.addEventListener("click", toggle);
    for (const n of nodes) {
        n.el.addEventListener("click", () => pick(n.item.value));
    }
    document.addEventListener("pointerdown", on_doc_pointer);
    root.addEventListener("keydown", on_keydown);

    sync();

    return {
        get_value: () => value,
        destroy() {
            document.removeEventListener("pointerdown", on_doc_pointer);
            root.remove();
        },
    };
}
