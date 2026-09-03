
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import {
    createIcons,
    ArrowRight,
    ChevronDown,
    FileText,
    FolderOpen,
    Ghost,
    Search,
    SearchCode,
    Sparkles,
    UploadCloud,
} from "lucide";

const USED_ICONS = {
    Search,
    UploadCloud,
    Sparkles,
    FolderOpen,
    FileText,
    SearchCode,
    ArrowRight,
    ChevronDown,
    Ghost,
};

export function refresh_icons(): void {
    createIcons({ icons: USED_ICONS });
}
