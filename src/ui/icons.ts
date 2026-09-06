
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import {
    createIcons,
    ArrowRight,
    ChevronDown,
    Download,
    Ellipsis,
    FileText,
    FolderOpen,
    Ghost,
    LoaderCircle,
    Search,
    Trash2,
    UploadCloud,
} from "lucide";

const USED_ICONS = {
    Search,
    UploadCloud,
    Trash2,
    FolderOpen,
    FileText,
    ArrowRight,
    ChevronDown,
    LoaderCircle,
    Download,
    Ellipsis,
    Ghost,
};

export function refresh_icons(): void {
    createIcons({ icons: USED_ICONS });
}
