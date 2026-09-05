
// Memoria
// Copyright (c) 2026 BaseTUT.
// Licensed under the MIT License.

import {
    createIcons,
    ArrowRight,
    ChevronDown,
    CircleStop,
    Download,
    Ellipsis,
    FileText,
    FolderOpen,
    Ghost,
    LoaderCircle,
    Search,
    SearchCode,
    Sparkles,
    UploadCloud,
    X,
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
    LoaderCircle,
    CircleStop,
    Download,
    Ellipsis,
    X,
    Ghost,
};

export function refresh_icons(): void {
    createIcons({ icons: USED_ICONS });
}
