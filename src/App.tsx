import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import llamaLogo from "./assets/images/llama_logo_avatar_1779308551622.png";
import {
  Sparkles,
  Check,
  Plus,
  Trash2,
  Copy,
  FolderArchive,
  Download,
  Upload,
  LogIn,
  LogOut,
  UserCheck,
  Languages,
  Calculator as CalcIcon,
  Gamepad2,
  Lock,
  Unlock,
  Pin,
  Search,
  Grid,
  AlertCircle,
  HelpCircle,
  Info,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Template, ShelfItem, SpellingError, UserAccount } from "./types";
import Calculator from "./components/Calculator";
import GameRunner from "./components/GameRunner";
import SpanishCorrector from "./components/SpanishCorrector";

const APP_PREFIX = "plantillabox";
const USERS_KEY = APP_PREFIX + "_users_obj";
const CURRENT_KEY = APP_PREFIX + "_current";
const GUEST_KEY = APP_PREFIX + "_guest_session";
const SHELF_KEY = (u: string) => APP_PREFIX + "_shelf_" + u;
const TEMPL_KEY = (u: string) => APP_PREFIX + "_tpls_" + u;

export default function App() {
  // State
  const [user, setUser] = useState<string>(() => {
    return sessionStorage.getItem(CURRENT_KEY) || "guest";
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Tool Windows (Calculator, Game Runner)
  const [showCalc, setShowCalc] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [calcZIndex, setCalcZIndex] = useState(500);
  const [gameZIndex, setGameZIndex] = useState(501);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register" | "guest">("login");
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Custom logout confirmation modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Custom shelf item delete confirmation state
  const [shelfDeleteConfirmState, setShelfDeleteConfirmState] = useState<{
    isOpen: boolean;
    id: string | null;
  }>({
    isOpen: false,
    id: null,
  });

  // Custom delete confirmation modal state
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: "individual" | "selected";
    id?: string;
  }>({
    isOpen: false,
    type: "individual",
  });

  // User input states (Auth modal)
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  // Import states
  const [importOption, setImportOption] = useState<"append" | "replace" | null>(null);
  const [importFileContent, setImportFileContent] = useState<any>(null);

  // App notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "warn">("success");

  // Spell-checking states indexed by template ID
  const [spellCheckResults, setSpellCheckResults] = useState<Record<string, SpellingError[]>>({});
  const [spellCheckingIds, setSpellCheckingIds] = useState<Set<string>>(new Set());
  const [spellCheckMessage, setSpellCheckMessage] = useState<Record<string, string>>({});

  // Refs for custom animations or state tracking
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show customized modern notifications
  const showToast = (msg: string, type: "success" | "info" | "warn" = "success") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Helper load utilities
  const getUsersObj = (): Record<string, { hash: string; createdAt: string }> => {
    const raw = localStorage.getItem(USERS_KEY);
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  };

  const saveUsersObj = (obj: any) => {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error("No se pudo guardar la base de usuarios local", e);
    }
  };

  const hashPassword = async (password: string): Promise<string> => {
    if (!password) return "";
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      const enc = new TextEncoder();
      const data = enc.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    // Fallback simple deterministic string hashing
    let h = 0;
    for (let i = 0; i < password.length; i++) {
      h = (h * 31 + password.charCodeAt(i)) >>> 0;
    }
    let hex = "";
    for (let i = 0; i < 8; i++) {
      hex += ("00000000" + ((h ^ (i * 2654435761)) >>> 0).toString(16)).slice(-8);
    }
    return hex;
  };

  // Load Templates & Shelf whenever User updates
  useEffect(() => {
    let tpls: Template[] = [];
    let shf: ShelfItem[] = [];

    if (user === "guest") {
      const rawTpls = sessionStorage.getItem(GUEST_KEY);
      tpls = rawTpls ? JSON.parse(rawTpls) : [];
      const rawShelf = sessionStorage.getItem(SHELF_KEY("guest"));
      shf = rawShelf ? JSON.parse(rawShelf) : [];
    } else {
      const rawTpls = localStorage.getItem(TEMPL_KEY(user));
      tpls = rawTpls ? JSON.parse(rawTpls) : [];
      const rawShelf = localStorage.getItem(SHELF_KEY(user));
      shf = rawShelf ? JSON.parse(rawShelf) : [];
    }

    setTemplates(tpls);
    setShelf(shf);
    setSelectedIds(new Set());
    setSpellCheckResults({});
    setSpellCheckingIds(new Set());
  }, [user]);

  // Persist templates globally on update
  const saveAndSetTemplates = (updated: Template[]) => {
    setTemplates(updated);
    if (user === "guest") {
      sessionStorage.setItem(GUEST_KEY, JSON.stringify(updated));
    } else {
      localStorage.setItem(TEMPL_KEY(user), JSON.stringify(updated));
    }
  };

  // Persist shelf globally on update
  const saveAndSetShelf = (updated: ShelfItem[]) => {
    setShelf(updated);
    if (user === "guest") {
      sessionStorage.setItem(SHELF_KEY("guest"), JSON.stringify(updated));
    } else {
      localStorage.setItem(SHELF_KEY(user), JSON.stringify(updated));
    }
  };

  // Action: Add New Template
  const handleAddNewTemplate = () => {
    const newId = "tpl_" + Math.random().toString(36).slice(2, 9);
    const newTpl: Template = {
      id: newId,
      title: "",
      content: "",
      modified: Date.now(),
      pinned: false,
      locked: false,
    };
    const updated = [newTpl, ...templates];
    saveAndSetTemplates(updated);
    setActiveCardId(newId);
    showToast("¡Nueva plantilla vacía creada!", "success");

    // Scroll to new template
    setTimeout(() => {
      const el = document.getElementById(newId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const ta = el.querySelector("textarea");
        if (ta) ta.focus();
      }
    }, 200);
  };

  // Action: Duplicate Template
  const handleDuplicateTemplate = (tpl: Template, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = "tpl_" + Math.random().toString(36).slice(2, 9);
    const duplicated: Template = {
      ...tpl,
      id: newId,
      title: tpl.title ? `${tpl.title} (copia)` : "Copia",
      pinned: false,
      modified: Date.now(),
    };
    const updated = [duplicated, ...templates];
    saveAndSetTemplates(updated);
    setActiveCardId(newId);
    showToast("Plantilla duplicada con éxito");
  };

  // Action: Toggle Checkbox Selection of a Card
  const handleToggleSelectCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Action: Select All templates
  const handleSelectAll = () => {
    const filteredTemplates = getFilteredTemplates();
    const allFilteredIds = filteredTemplates.map((t) => t.id);
    const someNotSelected = allFilteredIds.some((id) => !selectedIds.has(id));

    const next = new Set(selectedIds);
    if (someNotSelected) {
      // Select all visible templates
      allFilteredIds.forEach((id) => next.add(id));
      showToast(`Seleccionadas las ${allFilteredIds.length} plantillas visibles`);
    } else {
      // Deselect all visible templates
      allFilteredIds.forEach((id) => next.delete(id));
      showToast("Selección deshecha");
    }
    setSelectedIds(next);
  };

  // Action: Clear selection state
  const handleClearSelection = () => {
    setSelectedIds(new Set());
    showToast("Selección cancelada");
  };

  // Action: Delete Selected templates
  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmState({
      isOpen: true,
      type: "selected",
    });
  };

  // Helper: Execute template deletion after custom modal confirmation
  const executeDelete = () => {
    if (deleteConfirmState.type === "individual" && deleteConfirmState.id) {
      const id = deleteConfirmState.id;
      const updated = templates.filter((t) => t.id !== id);
      saveAndSetTemplates(updated);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast("Plantilla eliminada correctamente");
    } else if (deleteConfirmState.type === "selected") {
      const updated = templates.filter((t) => !selectedIds.has(t.id));
      saveAndSetTemplates(updated);
      setSelectedIds(new Set());
      showToast("Plantillas seleccionadas eliminadas");
    }
    setDeleteConfirmState({ isOpen: false, type: "individual" });
  };

  // Action: Archive Selected templates to Estantería
  const handleArchiveSelected = () => {
    if (selectedIds.size === 0) return;
    const itemsToArchive = templates.filter((t) => selectedIds.has(t.id));
    const newShelfItems: ShelfItem[] = itemsToArchive.map((item) => ({
      id: item.id,
      title: item.title || "Sin título",
      content: item.content,
      modified: Date.now(),
    }));

    saveAndSetShelf([...newShelfItems, ...shelf]);
    const remaining = templates.filter((t) => !selectedIds.has(t.id));
    saveAndSetTemplates(remaining);
    setSelectedIds(new Set());
    showToast(`Archivadas ${itemsToArchive.length} plantillas en la estantería`);
  };

  // Action: Toggle Pin state
  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = templates.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t));
    saveAndSetTemplates(updated);
    const item = updated.find((t) => t.id === id);
    if (item) {
      showToast(item.pinned ? "Plantilla fijada arriba 📌" : "Desanclada de arriba 📍");
    }
  };

  // Action: Toggle Lock state
  const handleToggleLock = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = templates.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t));
    saveAndSetTemplates(updated);
    const item = updated.find((t) => t.id === id);
    if (item) {
      showToast(item.locked ? "Plantilla bloqueada para evitar modificaciones 🔒" : "Desbloqueada 🔓");
    }
  };

  // Action: Simple copy content to clipboard
  const handleCopyContent = async (content: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!content) {
      showToast("Contenido vacío", "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      showToast("Copiado al portapapeles 📋", "success");
    } catch (err) {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = content;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const rc = document.execCommand("copy");
      document.body.removeChild(ta);
      if (rc) showToast("Copiado al portapapeles 📋", "success");
      else showToast("No se pudo copiar", "warn");
    }
  };

  // Action: Delete Individual Template
  const handleDeleteIndividual = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    if (target.locked) {
      showToast("No se puede eliminar porque está bloqueada 🔒", "warn");
      return;
    }
    setDeleteConfirmState({
      isOpen: true,
      type: "individual",
      id: id,
    });
  };

  // Action: Archive Individual Template
  const handleArchiveIndividual = (tpl: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    const newShelfItem: ShelfItem = {
      id: tpl.id,
      title: tpl.title || "Sin título",
      content: tpl.content,
      modified: Date.now(),
    };
    saveAndSetShelf([newShelfItem, ...shelf]);
    const remaining = templates.filter((t) => t.id !== tpl.id);
    saveAndSetTemplates(remaining);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(tpl.id);
      return next;
    });
    showToast("Plantilla trasladada a la estantería 📁");
  };

  // Action: Clear Content of active card
  const handleClearCardContent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    if (target.locked) {
      showToast("La plantilla está bloqueada 🔒", "warn");
      return;
    }
    const updated = templates.map((t) => (t.id === id ? { ...t, content: "", modified: Date.now() } : t));
    saveAndSetTemplates(updated);
    showToast("Contenido despejado");
  };

  // Filter templates based on Search query
  const getFilteredTemplates = () => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = templates.filter((t) => {
      return (
        !q ||
        (t.title || "").toLowerCase().includes(q) ||
        (t.content || "").toLowerCase().includes(q)
      );
    });

    // Sort to keep Pinned ones at the top, then modified dates
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.modified - a.modified;
    });
  };

  // Format UNIX timestamp elegantly helper
  const formatTimestamp = (ts: number): string => {
    try {
      const date = new Date(ts);
      return date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  };

  // Action: Check orthography using Express AI spelling microservice
  const handleSpellCheck = async (tplId: string, text: string) => {
    if (!text || text.trim().length === 0) {
      setSpellCheckMessage((prev) => ({
        ...prev,
        [tplId]: "Escribe texto primero para revisarlo.",
      }));
      return;
    }

    setSpellCheckingIds((prev) => {
      const next = new Set(prev);
      next.add(tplId);
      return next;
    });

    setSpellCheckMessage((prev) => ({
      ...prev,
      [tplId]: "",
    }));

    try {
      const response = await fetch("/api/spellcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("No se pudo obtener respuesta del corrector.");
      }

      const data = await response.json();
      if (data.errors && Array.isArray(data.errors)) {
        setSpellCheckResults((prev) => ({
          ...prev,
          [tplId]: data.errors,
        }));

        if (data.errors.length === 0) {
          setSpellCheckMessage((prev) => ({
            ...prev,
            [tplId]: "¡Impecable! No se encontraron faltas de ortografía. ✨",
          }));
        }
      } else {
        setSpellCheckMessage((prev) => ({
          ...prev,
          [tplId]: "Error al procesar la auditoría.",
        }));
      }
    } catch (error) {
      console.error(error);
      setSpellCheckMessage((prev) => ({
        ...prev,
        [tplId]: "Fallo de conexión con el corrector de ortografía.",
      }));
    } finally {
      setSpellCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(tplId);
        return next;
      });
    }
  };

  // Apply individual replacement recommendation
  const handleApplySpellcheckedFix = (
    tplId: string,
    originalWord: string,
    replacement: string
  ) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;

    // Use a word-boundary based string replace to update first matching spelling error
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapeRegExp(originalWord)}\\b`, "i");
    const updatedContent = tpl.content.replace(regex, replacement);

    const updated = templates.map((t) =>
      t.id === tplId
        ? { ...t, content: updatedContent, modified: Date.now() }
        : t
    );
    saveAndSetTemplates(updated);

    // Filter applied word out of the recommendations checklist
    setSpellCheckResults((prev) => {
      const currentArr = prev[tplId] || [];
      const filtered = currentArr.filter((err) => err.word !== originalWord);
      return {
        ...prev,
        [tplId]: filtered,
      };
    });

    showToast(`Corregido "${originalWord}" por "${replacement}"`);
  };

  // Action: Authenticate / Login system
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const term = usernameInput.trim();
    if (!term) {
      setAuthError("El nombre de usuario es requerido.");
      return;
    }
    if (passwordInput.length < 6) {
      setAuthError("La contraseña debe tener un mínimo de 6 caracteres.");
      return;
    }

    const hash = await hashPassword(passwordInput);
    const db = getUsersObj();

    if (authTab === "login") {
      if (!db[term]) {
        setAuthError("Nombre de usuario no localizado localmente.");
        return;
      }
      if (db[term].hash !== hash) {
        setAuthError("La contraseña es incorrecta.");
        return;
      }

      sessionStorage.setItem(CURRENT_KEY, term);
      setUser(term);
      setShowAuthModal(false);
      showToast(`¡Bienvenido, ${term}!`);
      // reset forms
      setUsernameInput("");
      setPasswordInput("");
    } else if (authTab === "register") {
      if (db[term]) {
        setAuthError("Este nombre de usuario ya está registrado.");
        return;
      }
      if (passwordInput !== passwordConfirm) {
        setAuthError("Las contraseñas no coinciden.");
        return;
      }

      db[term] = { hash, createdAt: new Date().toISOString() };
      saveUsersObj(db);

      // Create initially duplicated guest list helper if user is transitioning
      try {
        if (templates.length > 0) {
          const trans = templates.map((t) => ({ ...t, id: "tpl_" + Math.random().toString(36).slice(2, 9) }));
          localStorage.setItem(TEMPL_KEY(term), JSON.stringify(trans));
        }
      } catch (e) {
        console.error(e);
      }

      sessionStorage.setItem(CURRENT_KEY, term);
      setUser(term);
      setShowAuthModal(false);
      showToast("¡Cuenta local creada con éxito!", "success");
      // reset forms
      setUsernameInput("");
      setPasswordInput("");
      setPasswordConfirm("");
    }
  };

  // Switch to Guest Session helper
  const handleSelectGuestSession = () => {
    sessionStorage.setItem(CURRENT_KEY, "guest");
    setUser("guest");
    setShowAuthModal(false);
    showToast("Has entrado como Invitado");
  };

  // Log Out active account
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirmExecute = () => {
    setShowLogoutConfirm(false);
    sessionStorage.setItem(CURRENT_KEY, "guest");
    setUser("guest");
    showToast("Sesión cerrada.");
  };

  // Action: Export templates as backup JSON
  const handleExportJSON = () => {
    const dataObj = {
      exportedAt: new Date().toISOString(),
      user: user,
      templates: templates,
      shelf: shelf,
    };

    const blob = new Blob([JSON.stringify(dataObj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plantillabox_respuestas_${user}_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Backup JSON descargado.");
  };

  // Action: Import templates file parse handler
  const handleImportJSONInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        if (Array.isArray(raw.templates)) {
          setImportFileContent(raw);
          setImportOption("append"); // default choice initial
        } else {
          alert("El archivo JSON no cumple con la estructura requerida.");
        }
      } catch (err) {
        alert("Archivo JSON corrupto o fallido.");
      }
    };
    reader.readAsText(files[0]);
  };

  // Commit imported files inside storage state
  const handleCommitImport = () => {
    if (!importFileContent) return;
    const list = importFileContent.templates as Template[];
    const reshaped = list.map((x) => ({
      id: "tpl_" + Math.random().toString(36).slice(2, 9),
      title: x.title || "",
      content: x.content || "",
      modified: x.modified || Date.now(),
      pinned: !!x.pinned,
      locked: !!x.locked,
    }));

    let nextTemplates = [...templates];
    if (importOption === "replace") {
      nextTemplates = reshaped;
    } else {
      nextTemplates = [...reshaped, ...templates];
    }

    saveAndSetTemplates(nextTemplates);

    // Import shelf backup list too if exists
    if (Array.isArray(importFileContent.shelf)) {
      const shfList = importFileContent.shelf as ShelfItem[];
      const shfMapped = shfList.map((x) => ({
        id: "shelf_" + Math.random().toString(36).slice(2, 9),
        title: x.title || "Sin título",
        content: x.content || "",
        modified: x.modified || Date.now(),
      }));

      if (importOption === "replace") {
        saveAndSetShelf(shfMapped);
      } else {
        saveAndSetShelf([...shfMapped, ...shelf]);
      }
    }

    setShowImportModal(false);
    setImportFileContent(null);
    setImportOption(null);
    showToast("Plantillas importadas de forma impecable.", "success");
  };

  // Action: Restore Archived item from shelf
  const handleRestoreFromShelf = (item: ShelfItem) => {
    const restored: Template = {
      id: "tpl_" + Math.random().toString(36).slice(2, 9),
      title: item.title,
      content: item.content,
      modified: Date.now(),
      pinned: false,
      locked: false,
    };

    saveAndSetTemplates([restored, ...templates]);
    const updatedShelf = shelf.filter((s) => s.id !== item.id);
    saveAndSetShelf(updatedShelf);
    showToast(`"${item.title}" restaurada a tus plantillas`);

    // Highlighting reconstructed template card in view
    setTimeout(() => {
      const el = document.getElementById(restored.id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-teal-400");
        setTimeout(() => el.classList.remove("ring-2", "ring-teal-400"), 1200);
      }
    }, 150);
  };

  // Action: Delete permanently archived item from shelf
  const handleDeleteFromShelf = (id: string) => {
    setShelfDeleteConfirmState({
      isOpen: true,
      id,
    });
  };

  const executeDeleteFromShelf = () => {
    if (shelfDeleteConfirmState.id) {
      const updated = shelf.filter((s) => s.id !== shelfDeleteConfirmState.id);
      saveAndSetShelf(updated);
      showToast("Plantilla borrada de forma permanente.");
    }
    setShelfDeleteConfirmState({ isOpen: false, id: null });
  };

  return (
    <div className="relative min-h-screen bg-[#050507] text-[#f8fafc] font-sans antialiased selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* Dynamic Ambient Blur Lights Background */}
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <div className="absolute top-[10%] left-[5%] w-96 h-96 bg-teal-500/[0.03] rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[480px] h-[480px] bg-indigo-500/[0.04] rounded-full blur-[140px]" />
      </div>

      {/* HEADER BAR - Premium Glass Design */}
      <header className="sticky top-0 z-40 bg-[#050507]/85 backdrop-blur-md border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand Logo & Slogan */}
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_25px_rgba(45,212,191,0.25)] hover:scale-105 transition-transform duration-300 shrink-0">
              <img
                src={llamaLogo}
                alt="Llama Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  PlantillaBox
                </h1>
                {user !== "guest" && (
                  <span className="inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm animate-pulse">
                    <UserCheck size={11} className="shrink-0" />
                    <span>¡HOLA, {user.toUpperCase()}!</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Tus respuestas rápidas, con corrector y calculadora integradas.
              </p>
            </div>
          </div>

          {/* Persistent Action Tray - Swipe/Scroll safe for dynamic split layout / double screen */}
          <div className="w-full md:w-auto overflow-hidden">
            <div className="flex items-center justify-between md:justify-end gap-3 flex-wrap md:flex-nowrap">
              
              {/* Account/User Status Indicator */}
              <div className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 text-xs shrink-0 select-none transition-all duration-300 ${
                user === "guest" 
                  ? "bg-white/[0.02] border-white/[0.05] text-slate-400" 
                  : "bg-teal-500/10 border-teal-500/30 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.1)]"
              }`}>
                <span className="relative flex h-2 w-2">
                  {user !== "guest" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${user === "guest" ? "bg-slate-500" : "bg-teal-400"}`}></span>
                </span>
                <span className="font-medium text-[11px]">
                  {user === "guest" ? (
                    <span className="font-mono text-[11px]">
                      Usuario: <strong className="text-slate-200">Invitado</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      Sesión: <strong className="text-white font-extrabold tracking-wide">{user}</strong>
                    </span>
                  )}
                </span>
              </div>

              {/* Responsive Options Buttons Scroll-tray */}
             <div className="flex items-center gap-1.5 overflow-x-auto hover-scrollbar-x max-w-full pb-1 -mb-1 scroll-smooth shrink-0">
                
                {/* Minijuegos Run Button */}
                <button
                  onClick={() => {
                    setGameZIndex((prev) => prev + 2);
                    setShowGame(true);
                  }}
                  className="btn whitespace-nowrap !py-1.5 !px-3 !rounded-xl text-xs bg-slate-900 border border-white/5 text-slate-300 hover:text-teal-400 hover:border-teal-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  title="Abrir correr del camello minijuego"
                >
                  <Gamepad2 size={13} className="text-teal-400" />
                  <span>🎮 Jugar</span>
                </button>

                {/* Calculator Button */}
                <button
                  onClick={() => {
                    setCalcZIndex((prev) => prev + 2);
                    setShowCalc(true);
                  }}
                  className="btn whitespace-nowrap !py-1.5 !px-3 !rounded-xl text-xs bg-slate-900 border border-white/5 text-slate-300 hover:text-indigo-400 hover:border-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  title="Abrir calculadora de matemáticas en ventana flotante"
                >
                  <CalcIcon size={13} className="text-indigo-400" />
                  <span>🧮 Calculadora</span>
                </button>

                {/* Archive Estantería Button */}
                <button
                  onClick={() => setShowShelfModal(true)}
                  className="btn whitespace-nowrap !py-1.5 !px-3 !rounded-xl text-xs bg-slate-900 border border-white/5 text-slate-300 hover:text-amber-400 hover:border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer z-5 shadow-md"
                  title="Ver plantillas archivadas temporalmente"
                >
                  <FolderArchive size={13} className="text-amber-400" />
                  <span>📁 Estantería ({shelf.length})</span>
                </button>

                {/* Export Button */}
                <button
                  onClick={handleExportJSON}
                  className="btn whitespace-nowrap !py-1.5 !px-3 !rounded-xl text-xs bg-slate-900 border border-white/5 text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  title="Exportar base en formato JSON"
                >
                  <Download size={13} className="text-slate-400" />
                  <span>Exportar</span>
                </button>

                {/* Import Button */}
                <button
                  onClick={() => setShowImportModal(true)}
                  className="btn whitespace-nowrap !py-1.5 !px-3 !rounded-xl text-xs bg-slate-900 border border-white/5 text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  title="Importar copias desde archivo JSON"
                >
                  <Upload size={13} className="text-slate-400" />
                  <span>Importar</span>
                </button>

                {/* Login or Logoff Switch Control Badge */}
                {user === "guest" ? (
                  <button
                    onClick={() => {
                      setAuthTab("login");
                      setShowAuthModal(true);
                    }}
                    className="btn whitespace-nowrap !py-1.5 !px-3.5 !rounded-xl text-xs bg-teal-500 text-[#050507] hover:bg-teal-400 font-bold hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_4px_12px_rgba(45,212,191,0.2)]"
                  >
                    <LogIn size={13} />
                    <span>Entrar</span>
                  </button>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="btn whitespace-nowrap !py-1.5 !px-3.5 !rounded-xl text-xs bg-slate-950/40 border border-rose-500/20 text-rose-300 hover:bg-rose-950/20 hover:border-rose-500/40 font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>Salir</span>
                  </button>
                )}
              </div>

            </div>
          </div>

        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* TOP COMPONENT CONTROL AND SEARCH BAR */}
        <section className="bg-slate-900/40 border border-white/[0.04] p-4 rounded-3xl mb-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            
            {/* Template Status / Meta Counter Info */}
            <div className="text-sm font-medium text-slate-400 flex items-center gap-2 self-start md:self-auto">
              <Grid size={15} className="text-teal-400" />
              <span>
                Colección:{" "}
                <strong className="text-white text-lg font-bold">
                  {templates.length}
                </strong>{" "}
                {templates.length === 1 ? "plantilla" : "plantillas"}
              </span>
              {selectedIds.size > 0 && (
                <span className="text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2.5 py-0.5 rounded-full font-semibold animate-pulse">
                  {selectedIds.size} seleccionada(s)
                </span>
              )}
            </div>

            {/* Combined actions row for creating templates and searching */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              
              {/* Elegant search query field */}
              <div className="relative flex-1 sm:w-72">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500Pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Buscar plantillas por palabras claves..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/[0.06] rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500/70 focus:ring-1 focus:ring-teal-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Master selection & template generation */}
              <div className="flex gap-2">
                
                {/* Master checkbox selector to quick select/deselect entire grid */}
                <button
                  onClick={handleSelectAll}
                  className="btn !py-2 !px-4 !rounded-xl text-xs bg-slate-900 hover:bg-neutral-800 text-slate-300 border border-white/5 hover:border-white/10 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Intercambiar la selección de todos los elementos visibles"
                >
                  <Check size={14} className={selectedIds.size > 0 ? "text-teal-400" : "text-slate-500"} />
                  <span>Seleccionar todo</span>
                </button>

                {/* Main "+ Nueva" button */}
                <button
                  onClick={handleAddNewTemplate}
                  className="btn primary flex-1 sm:flex-none !py-2 !px-4.5 !rounded-xl text-xs bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(45,212,191,0.25)]"
                >
                  <Plus size={15} />
                  <span>Nueva Plantilla</span>
                </button>

              </div>

            </div>
          </div>
        </section>

        {/* MULTISELECT BULK OPTIONS NOTIFIER PANEL */}
        {selectedIds.size > 0 && (
          <div className="sticky top-20 z-30 bg-teal-950/85 backdrop-blur-md border border-teal-500/30 p-3.5 rounded-2xl mb-6 shadow-[0_10px_30px_rgba(45,212,191,0.1)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-slideDown">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
              <span className="text-xs font-semibold text-teal-300">
                Operaciones por lote para <strong className="text-white text-sm bg-white/10 px-2 py-0.5 rounded-md">{selectedIds.size}</strong> plantilla(s) seleccionada(s):
              </span>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Archive selection button */}
              <button
                onClick={handleArchiveSelected}
                className="btn small flex-1 sm:flex-none !bg-white/10 hover:!bg-white/20 !text-slate-100 border border-teal-500/20 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <FolderArchive size={12} />
                <span>Archivar</span>
              </button>

              {/* Delete selection button */}
              <button
                onClick={handleDeleteSelected}
                className="btn small flex-1 sm:flex-none !bg-rose-500/10 hover:!bg-rose-500/20 hover:!border-rose-500/50 !text-rose-300 border border-rose-500/20 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} />
                <span>Borrar seleccionadas</span>
              </button>

              {/* Cancel operation button */}
              <button
                onClick={handleClearSelection}
                className="btn small flex-1 sm:flex-none !bg-transparent hover:!bg-white/[0.04] !text-slate-300 border border-transparent py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* EMPTY STATE BLOCK */}
        {getFilteredTemplates().length === 0 && (
          <div className="text-center py-20 px-4 border border-dashed border-white/5 rounded-3xl bg-white/[0.01] animate-fadeIn">
            <span className="text-5xl block mb-4 filter drop-shadow-md">📁</span>
            <h3 className="text-lg font-bold text-slate-200">No hay plantillas que mostrar</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
              {searchQuery
                ? "Ninguna plantilla coincide con los términos de búsqueda introducidos."
                : "Aún no has creado respuestas rápidas. Presiona el botón '+ Nueva' arriba para diseñar tu primera plantilla profesional."}
            </p>
          </div>
        )}

        {/* MAIN RESPONSIVE WEB CARD GRID */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {getFilteredTemplates().map((tpl) => {
              const isSelected = selectedIds.has(tpl.id);
              const isSpellchecking = spellCheckingIds.has(tpl.id);
              const errorsList = spellCheckResults[tpl.id] || [];
              const feedbackMsg = spellCheckMessage[tpl.id] || "";

              return (
                <motion.article
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 25 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -25 }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 18,
                    mass: 0.8,
                    layout: { type: "spring", stiffness: 350, damping: 25 }
                  }}
                  key={tpl.id}
                  id={tpl.id}
                  onPointerDown={() => setActiveCardId(tpl.id)}
                  className={`group relative flex flex-col justify-between bg-slate-900/30 border rounded-2xl min-h-[220px] transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl ${
                    isSelected
                      ? "border-teal-500/70 bg-teal-500/[0.01]"
                      : tpl.id === activeCardId
                      ? "border-white/15 bg-white/[0.01]"
                      : "border-white/[0.06]"
                  } ${tpl.locked ? "opacity-90 grayscale-[15%]" : ""} focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.45),inset_0_0_15px_rgba(45,212,191,0.45)]`}
                >
                  
                  {/* Dynamic Subtle Pinned/Locked Top Indicators Tag */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                    {tpl.pinned && (
                      <span 
                        onClick={(e) => handleTogglePin(tpl.id, e)}
                        className="p-1 hover:bg-white/5 rounded-md cursor-pointer text-teal-400" 
                        title="Anclada al principio"
                      >
                        <Pin size={11} className="fill-teal-400" />
                      </span>
                    )}
                    {tpl.locked && (
                      <span 
                        onClick={(e) => handleToggleLock(tpl.id, e)}
                        className="p-1 hover:bg-white/5 rounded-md cursor-pointer text-amber-500" 
                        title="Contenido bloqueado"
                      >
                        <Lock size={11} />
                      </span>
                    )}
                  </div>

                  {/* CARD BODY CONTENT */}
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    
                    {/* Top line selection checkbox & custom title input field */}
                    <div className="flex gap-2.5 items-center">
                      
                      {/* Checkbox Selector */}
                      <button
                        onClick={(e) => handleToggleSelectCard(tpl.id, e)}
                        className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-teal-500 border-teal-500 text-[#050507]"
                            : "border-white/20 bg-slate-950/60 hover:border-white/30"
                        }`}
                        title={isSelected ? "Deseleccionar" : "Seleccionar"}
                      >
                        {isSelected && <Check size={11} className="stroke-[3]" />}
                      </button>

                      {/* Title input field */}
                      <input
                        type="text"
                        placeholder="Sin título (clic para añadir)"
                        value={tpl.title}
                        readOnly={tpl.locked}
                        onChange={(e) => {
                          const updated = templates.map((t) =>
                            t.id === tpl.id ? { ...t, title: e.target.value, modified: Date.now() } : t
                          );
                          saveAndSetTemplates(updated);
                        }}
                        className="bg-transparent border-none text-slate-100 font-bold text-sm tracking-tight placeholder:text-slate-600 focus:outline-none flex-1 truncate py-0.5"
                      />

                    </div>

                    {/* Main editing textarea with auto-resizable styling helper */}
                    <div className="relative">
                      <textarea
                        placeholder="Escribe el borrador o contenido de tu plantilla rápida aquí..."
                        value={tpl.content}
                        readOnly={tpl.locked}
                        onChange={(e) => {
                          const updated = templates.map((t) =>
                            t.id === tpl.id ? { ...t, content: e.target.value, modified: Date.now() } : t
                          );
                          // Clean previous spelling errors on update to stay consistent
                          if (spellCheckResults[tpl.id]) {
                            setSpellCheckResults((prev) => {
                              const next = { ...prev };
                              delete next[tpl.id];
                              return next;
                            });
                          }
                          saveAndSetTemplates(updated);
                        }}
                        className="w-full bg-[#0a0a0d]/60 border border-white/[0.04] focus:border-white/[0.08] rounded-xl p-3.5 text-xs text-slate-300 font-mono leading-relaxed placeholder:text-slate-600 min-h-[110px] max-h-[250px] resize-y focus:outline-none focus:ring-1 focus:ring-teal-400/20 focus:bg-[#0a0a0d]/80 transition-all font-medium"
                      />
                    </div>

                  </div>

                  {/* CARD SPELL CHECK RECOMMENDATION BAR Tray */}
                  {(errorsList.length > 0 || feedbackMsg || isSpellchecking) && (
                    <div className="mx-5 mb-2 px-3 py-2 bg-slate-950/80 border border-teal-500/20 rounded-xl max-h-32 overflow-y-auto scrollbar animate-fadeIn">
                      
                      {/* Spinning loader status */}
                      {isSpellchecking && (
                        <div className="flex items-center gap-1.5 text-[10px] text-teal-400 font-mono py-1">
                          <RefreshCw size={11} className="animate-spin" />
                          <span>Analizando ortografía...</span>
                        </div>
                      )}

                      {/* Check complete empty status feedback */}
                      {!isSpellchecking && feedbackMsg && (
                        <div className="text-[10px] text-slate-400 font-medium py-1 flex items-center gap-1.5">
                          <Check size={11} className="text-teal-400 shrink-0" />
                          <span>{feedbackMsg}</span>
                        </div>
                      )}

                      {/* Actionable spelling suggestions List */}
                      {!isSpellchecking && errorsList.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[9px] uppercase tracking-wider text-teal-400 font-semibold mb-1 flex items-center gap-1">
                            <AlertCircle size={9} className="text-amber-400" />
                            <span>Recomendaciones Ortográficas:</span>
                          </div>
                          {errorsList.map((err, idx) => (
                            <div
                              key={idx}
                              className="text-[10px] py-1 px-1.5 bg-slate-900 border border-rose-500/10 rounded flex flex-wrap items-center justify-between gap-1.5"
                            >
                              <span className="shrink-1 truncate">
                                <span className="text-rose-400 line-through font-semibold font-mono mr-1">{err.word}</span>
                                <span className="text-slate-500 text-[9px] italic">({err.reason})</span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {err.replacements.slice(0, 3).map((rep, repIdx) => (
                                  <button
                                    key={repIdx}
                                    onClick={() => handleApplySpellcheckedFix(tpl.id, err.word, rep)}
                                    className="bg-teal-500 text-slate-950 px-1.5 py-0.2 rounded font-mono text-[9px] font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer hover:bg-teal-400"
                                  >
                                    {rep}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                  {/* BOTTOM METADATA & ACTIONS PANEL */}
                  <div className="px-5 pb-4 pt-1 border-t border-white/[0.03] bg-white/[0.005]">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-2.5">
                      <span>{tpl.content ? tpl.content.length : 0} caracteres</span>
                      <span>Mod: {formatTimestamp(tpl.modified)}</span>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-1">
                      
                      {/* Spellcheck Trigger Toggle button */}
                      <button
                        onClick={() => handleSpellCheck(tpl.id, tpl.content)}
                        disabled={isSpellchecking || tpl.locked}
                        className="btn small !py-1 !px-2.5 !rounded-lg text-[10px] bg-teal-500/5 hover:bg-teal-500/10 hover:text-white border border-teal-500/10 focus:ring-1 focus:ring-teal-400/30 text-teal-300 disabled:opacity-40 transition-all font-semibold flex items-center gap-1 cursor-pointer"
                        title="Auditar ortografía en español usando inteligencia artificial"
                      >
                        <Sparkles size={10} className="text-teal-400" />
                        <span>Ortografía</span>
                      </button>

                      {/* Toolbar Action Drawer */}
                      <div className="flex gap-1">
                        
                        {/* Copy Action button */}
                        <button
                          onClick={(e) => handleCopyContent(tpl.content, e)}
                          className="btn small !py-1 !px-2.5 !rounded-lg text-[10px] bg-slate-950/40 border border-white/5 hover:border-white/10 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer flex items-center justify-center font-bold"
                          title="Copiar rápido plantilla al portapapeles"
                        >
                          <Copy size={11} className="mr-0.5" />
                          <span>Copiar</span>
                        </button>

                        {/* Dropdown Options Indicator for more act */}
                        <div className="relative group/menu">
                          <button
                            className="btn small !py-1 !px-2.5 !rounded-lg text-[10px] bg-slate-950/40 border border-white/5 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
                          >
                            Más ⋯
                          </button>
                          
                          {/* Hover Popup Actions Grid */}
                          <div className="absolute bottom-6 right-0 hidden group-hover/menu:block hover:block bg-slate-950 border border-white/10 p-1.5 rounded-xl text-slate-400 font-sans z-20 min-w-[150px] shadow-2xl space-y-0.5 animate-fadeIn">
                            
                            {/* LOCK TOGGLE */}
                            <button
                              onClick={(e) => handleToggleLock(tpl.id, e)}
                              className="w-full text-left px-2.5 py-1.5 text-[10px] hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                            >
                              {tpl.locked ? <Unlock size={11} /> : <Lock size={11} />}
                              <span>{tpl.locked ? "Desbloquear" : "Bloquear"}</span>
                            </button>

                            {/* PIN TOGGLE */}
                            <button
                              onClick={(e) => handleTogglePin(tpl.id, e)}
                              className="w-full text-left px-2.5 py-1.5 text-[10px] hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                            >
                              <Pin size={11} />
                              <span>{tpl.pinned ? "Desanclar" : "Fijar Arriba"}</span>
                            </button>

                            {/* DUPLICATE */}
                            <button
                              onClick={(e) => handleDuplicateTemplate(tpl, e)}
                              className="w-full text-left px-2.5 py-1.5 text-[10px] hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                            >
                              <Copy size={11} />
                              <span>Duplicar</span>
                            </button>

                            {/* ARCHIVE TO SHELF */}
                            <button
                              onClick={(e) => handleArchiveIndividual(tpl, e)}
                              className="w-full text-left px-2.5 py-1.5 text-[10px] hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                            >
                              <FolderArchive size={11} />
                              <span>Archivar</span>
                            </button>

                            {/* VACIAR CONTENIDO */}
                            <button
                              onClick={(e) => handleClearCardContent(tpl.id, e)}
                              className="w-full text-left px-2.5 py-1.5 text-[10px] hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2 cursor-pointer font-medium text-slate-400"
                            >
                              <RefreshCw size={11} />
                              <span>Vaciar contenido</span>
                            </button>

                            <div className="border-t border-white/5 my-1" />

                            {/* DELETE */}
                            <button
                              onClick={(e) => handleDeleteIndividual(tpl.id, e)}
                              disabled={tpl.locked}
                              className="w-full text-left px-2.5 py-1.5 text-[10px] hover:text-white hover:bg-rose-950/40 hover:text-rose-300 rounded-lg flex items-center gap-2 cursor-pointer font-medium text-rose-500 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <Trash2 size={11} />
                              <span>Eliminar</span>
                            </button>

                          </div>

                        </div>

                      </div>

                    </div>

                  </div>

                </motion.article>
              );
            })}
          </AnimatePresence>
        </section>

      </main>

      {/* FLOATING WINDOWS - DRAGGABLE & RESIZABLE CHANNELS */}

      {/* FLOAT: MATH CALCULATOR */}
      {showCalc && (
        <Calculator
          zIndex={calcZIndex}
          onFocus={() => setCalcZIndex((prev) => Math.max(gameZIndex + 1, prev + 1))}
          onClose={() => setShowCalc(false)}
        />
      )}

      {/* FLOAT: GAME RUNNER */}
      {showGame && (
        <GameRunner
          zIndex={gameZIndex}
          onFocus={() => setGameZIndex((prev) => Math.max(calcZIndex + 1, prev + 1))}
          onClose={() => setShowGame(false)}
        />
      )}

      {/* FOOTER NOTIFIER INFO */}
      <footer className="border-t border-white/[0.04] mt-24 py-8 bg-[#0a0a0d] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-2">
          <p className="font-semibold text-slate-400">
            PlantillaBox — Espacio de respuestas rápidas y asistent de productividad.
          </p>
          <p>
            {user === "guest"
              ? "Sesión de invitado temporal activa. Registra una cuenta local en este navegador para guardar progreso de forma indefinida."
              : "Sesión persistente cifrada dentro del almacenamiento local seguro de tu navegador."}
          </p>
          <div className="text-[11px] text-slate-600 font-mono mt-1 pt-2 border-t border-white/5 max-w-xs mx-auto">
            Configuración y progreso sincronizados con el navegador.
          </div>
        </div>
      </footer>

      {/* GLOBAL NOTIFICATION TOAST BOX */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-slideUp">
          <div className="bg-slate-900 border border-white/10 text-slate-100 py-3 px-6 rounded-full shadow-2xl flex items-center gap-2 max-w-md">
            <Check size={16} className="text-teal-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* MODAL OVERLAYS */}

      {/* MODAL: CUSTOM CONFIRM LOGOUT */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ 
                scale: 1, 
                y: 0, 
                opacity: 1,
                transition: {
                  type: "spring",
                  stiffness: 300,
                  damping: 18,
                  mass: 0.95
                }
              }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              className="bg-[#121216] border border-teal-500/20 max-w-sm w-full rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(45,212,191,0.15)] relative"
            >
              <div className="h-1 bg-gradient-to-r from-teal-500 to-indigo-500 w-full" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                    <LogOut size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      Cerrar Sesión
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Volver a sesión de invitado</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans mb-6">
                  ¿Seguro que deseas cerrar la sesión actual y salir de tu cuenta?
                </p>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 bg-[#1a1a24] hover:bg-white/5 active:scale-95 border border-white/5 hover:border-white/10 text-slate-300 transition-all text-xs font-bold py-2.5 rounded-xl cursor-pointer"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleLogoutConfirmExecute}
                    className="flex-1 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 hover:shadow-[0_4px_15px_rgba(45,212,191,0.2)] active:scale-95 text-slate-950 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CUSTOM DELETION FROM ARCHIVE SHELF */}
      <AnimatePresence>
        {shelfDeleteConfirmState.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ 
                scale: 1, 
                y: 0, 
                opacity: 1,
                transition: {
                  type: "spring",
                  stiffness: 300,
                  damping: 18,
                  mass: 0.95
                }
              }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              className="bg-[#121216] border border-red-500/20 max-w-sm w-full rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] relative"
            >
              <div className="h-1 bg-gradient-to-r from-red-500 to-amber-500 w-full" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      Eliminar de Archivo
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Eliminación permanente</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans mb-6">
                  ¿Estás seguro de que deseas eliminar permanentemente esta plantilla archivada? Esta acción no se puede deshacer.
                </p>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShelfDeleteConfirmState({ isOpen: false, id: null })}
                    className="flex-1 bg-[#1a1a24] hover:bg-white/5 active:scale-95 border border-white/5 hover:border-white/10 text-slate-300 transition-all text-xs font-bold py-2.5 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={executeDeleteFromShelf}
                    className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 hover:shadow-[0_4px_15px_rgba(239,68,68,0.2)] active:scale-95 text-slate-950 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CUSTOM CONFIRM DELETE */}
      <AnimatePresence>
        {deleteConfirmState.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ 
                scale: 1, 
                y: 0, 
                opacity: 1,
                transition: {
                  type: "spring",
                  stiffness: 300,
                  damping: 18,
                  mass: 0.95
                }
              }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              className="bg-[#121216] border border-red-500/20 max-w-sm w-full rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] relative"
            >
              <div className="h-1 bg-gradient-to-r from-red-500 to-amber-500 w-full" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      Confirmar Eliminación
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Acción irreversible</p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans mb-6">
                  {deleteConfirmState.type === "individual"
                    ? "¿Seguro que deseas eliminar definitivamente esta plantilla de respuesta rápida?"
                    : `¿Seguro que deseas eliminar definitivamente las ${selectedIds.size} plantillas seleccionadas?`}
                </p>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => setDeleteConfirmState({ isOpen: false, type: "individual" })}
                    className="flex-1 bg-[#1a1a24] hover:bg-white/5 active:scale-95 border border-white/5 hover:border-white/10 text-slate-300 transition-all text-xs font-bold py-2.5 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={executeDelete}
                    className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 hover:shadow-[0_4px_15px_rgba(239,68,68,0.2)] active:scale-95 text-slate-950 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: AUTHENTICATION LOGIN AND REGISTER */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#121216] border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative animate-slideUp">
            
            <div className="h-1 bg-gradient-to-r from-teal-400 to-indigo-500 w-full" />
            
            <div className="p-6">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <span>🔑</span> Acceso Local Seguro
                </h3>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              {/* Error feedback if any */}
              {authError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl mb-4 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Tabs selector */}
              <div className="flex bg-black/40 p-1 rounded-xl mb-5 border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("login");
                    setAuthError("");
                  }}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authTab === "login" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("register");
                    setAuthError("");
                  }}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authTab === "register" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Registrarse
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("guest");
                    setAuthError("");
                  }}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authTab === "guest" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Invitado
                </button>
              </div>

              {/* Forms panel */}
              {authTab !== "guest" ? (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre de Usuario
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: erickbox"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between">
                      <span>Contraseña de acceso</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full bg-black/30 border border-white/5 rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {authTab === "register" && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Confirmar Contraseña
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
                        required
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all tracking-wider uppercase mt-2 shadow-lg shadow-teal-500/10 cursor-pointer"
                  >
                    {authTab === "login" ? "Iniciar Sesión" : "Crear registrar cuenta"}
                  </button>

                  <p className="text-[10px] text-slate-500 italic mt-3 text-center">
                    Los datos de las cuentas se almacenan de forma local cifrada en tu navegador web.
                  </p>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-slate-300 leading-relaxed">
                    El modo de <strong>Invitado</strong> almacena todo en la sesión de la pestaña actual. Las plantillas se perderán si el navegador se cierra. Utiliza este modo para pruebas rápidas.
                  </div>
                  <button
                    onClick={handleSelectGuestSession}
                    className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-2.5 rounded-xl text-xs transition-all tracking-wider uppercase cursor-pointer"
                  >
                    Entrar como Invitado
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESTANTERÍA SHELF MANAGER */}
      {showShelfModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#121216] border border-white/10 max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl relative animate-slideUp">
            <div className="h-1 bg-amber-400 w-full" />
            <div className="p-6">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <FolderArchive size={18} className="text-amber-400" />
                  <span>Estantería de Archivados</span>
                </h3>
                <button
                  onClick={() => setShowShelfModal(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer decoration-none"
                >
                  Cerrar
                </button>
              </div>

              {/* Description information */}
              <p className="text-[11px] text-slate-400 mb-4 font-medium leading-relaxed">
                Aquí se conservan las plantillas retiradas temporalmente. Puedes restaurarlas a la cuadrícula activa en cualquier instante.
              </p>

              {/* Shelf list container */}
              <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar">
                {shelf.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-white/5 rounded-xl text-slate-500 text-xs">
                    No tienes ninguna plantilla archivada por el momento.
                  </div>
                ) : (
                  shelf.map((shItem) => (
                    <div
                      key={shItem.id}
                      className="p-3.5 bg-[#0a0a0d] border border-white/[0.04] hover:border-white/10 rounded-xl transition-all font-sans text-xs"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-slate-200 text-sm">{shItem.title}</strong>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {formatTimestamp(shItem.modified)}
                        </span>
                      </div>
                      <p className="text-slate-400 font-mono text-[11px] line-clamp-3 leading-relaxed mb-3 break-all">
                        {shItem.content || "(Contenido vacío)"}
                      </p>
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleRestoreFromShelf(shItem)}
                          className="btn small !py-1 !px-2.5 !rounded-lg text-[10px] bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 transition-all font-semibold cursor-pointer"
                        >
                          Restaurar
                        </button>
                        <button
                          onClick={() => handleDeleteFromShelf(shItem.id)}
                          className="btn small danger !py-1 !px-2.5 !rounded-lg text-[10px] transition-all font-semibold cursor-pointer"
                        >
                          Eliminar permanente
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT JSON FILE */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#121216] border border-white/10 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative animate-slideUp">
            <div className="h-1 bg-gradient-to-r from-blue-400 to-teal-500 w-full" />
            <div className="p-6">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Upload size={18} className="text-teal-400" />
                  <span>Importar Plantillas</span>
                </h3>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFileContent(null);
                    setImportOption(null);
                  }}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              {/* Form Input File */}
              {!importFileContent ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sube un respaldo previo en formato JSON de PlantillaBox para recuperar tus plantillas almacenadas.
                  </p>
                  
                  <div className="border border-dashed border-white/10 rounded-xl p-6 text-center bg-black/20 hover:bg-black/30 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportJSONInput}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <Upload size={24} className="mx-auto text-slate-400 mb-2.5" />
                    <span className="text-xs font-semibold text-teal-400">
                      Haz clic para examinar archivos JSON
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                      (plantillabox_respuestas_...)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-teal-550/10 border border-teal-500/20 text-teal-300 text-xs rounded-xl flex items-start gap-2">
                    <Check size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>Archivo válido cargado.</strong> Contiene{" "}
                      <span className="text-white font-bold underline">
                        {importFileContent.templates ? importFileContent.templates.length : 0}
                      </span>{" "}
                      plantillas listas para importar.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Método de Importación:
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImportOption("append")}
                        className={`flex-1 py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                          importOption === "append"
                            ? "bg-teal-500/10 border-teal-550 text-white shadow-lg"
                            : "bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span className="text-sm">➕</span>
                        <span>Mantener actuales</span>
                        <span className="text-[9px] text-slate-500 font-mono">(Añadir al final)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportOption("replace")}
                        className={`flex-1 py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                          importOption === "replace"
                            ? "bg-rose-500/10 border-rose-500/50 text-rose-300 shadow-lg"
                            : "bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span className="text-sm">⚠️</span>
                        <span>Sobrescribir todo</span>
                        <span className="text-[9px] text-rose-400/50 font-mono">(Limpiar base anterior)</span>
                      </button>
                    </div>

                  </div>

                  <button
                    onClick={handleCommitImport}
                    className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all tracking-wider uppercase mt-2 cursor-pointer shadow-md shadow-teal-500/10"
                  >
                    Confirmar e Importar
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
