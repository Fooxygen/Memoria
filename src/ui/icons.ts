
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import {
    createIcons,
    ArrowRight,
    BookOpen,
    ChevronsLeft,
    Download,
    Ellipsis,
    LoaderCircle,
    Search,
    Trash2,
    UploadCloud,
    X,
} from "lucide";

const USED_ICONS = {
    Search,
    UploadCloud,
    Trash2,
    ArrowRight,
    BookOpen,
    ChevronsLeft,
    LoaderCircle,
    Download,
    Ellipsis,
    X,
};

export function refresh_icons(): void {
    createIcons({ icons: USED_ICONS });
}
