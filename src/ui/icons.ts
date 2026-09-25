
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import {
    createIcons,
    ArrowRight,
    Download,
    Ellipsis,
    LoaderCircle,
    Search,
    Trash2,
    UploadCloud,
} from "lucide";

const USED_ICONS = {
    Search,
    UploadCloud,
    Trash2,
    ArrowRight,
    LoaderCircle,
    Download,
    Ellipsis,
};

export function refresh_icons(): void {
    createIcons({ icons: USED_ICONS });
}
