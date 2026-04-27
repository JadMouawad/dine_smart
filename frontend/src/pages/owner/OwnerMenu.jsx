import React, { useEffect, useMemo, useState } from "react";
import { getMyRestaurant, updateMyRestaurant } from "../../services/restaurantService";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import ThemedSelect from "../../components/ThemedSelect.jsx";

const CURRENCIES = ["USD", "LBP", "EUR"];

function DragHandIcon() {
  return (
    <svg
      className="menuReorderHandle__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V7a1.5 1.5 0 0 1 3 0v5" />
      <path d="M17 12.5V10a1.5 1.5 0 0 1 3 0v4.5c0 4.1-2.7 6.5-7 6.5h-1.4c-2.6 0-4.1-1-5.6-3.1L3.7 14.5a1.65 1.65 0 0 1 2.7-1.9L8 14.3V11" />
    </svg>
  );
}

function moveBefore(list, activeId, overId) {
  if (!activeId || !overId || activeId === overId) return list;

  const activeIndex = list.findIndex((entry) => entry.id === activeId);
  const overIndex = list.findIndex((entry) => entry.id === overId);
  if (activeIndex === -1 || overIndex === -1) return list;

  const next = [...list];
  const [active] = next.splice(activeIndex, 1);
  next.splice(overIndex, 0, active);
  return next;
}

function normalizeMenuFromApi(menuSections) {
  const list = Array.isArray(menuSections) ? menuSections : [];
  const sections = [];
  const items = [];
  list.forEach((sec) => {
    const sectionId = sec.sectionId || sec.section_id || sec.id;
    const sectionName = sec.sectionName || sec.section_name || sec.name || "Section";
    sections.push({ id: sectionId, name: sectionName });
    (sec.items || []).forEach((it) => {
      items.push({
        id: it.id || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sectionId,
        name: it.name || "",
        price: it.price || "",
        currency: it.currency || "USD",
        description: it.description || "",
        imagePreviewUrl: it.imageUrl || it.image_url || "",
      });
    });
  });
  return { sections, items };
}

function serializeMenuToApi(sections, items) {
  return sections.map((s) => ({
    sectionId: s.id,
    sectionName: s.name,
    items: items
      .filter((i) => i.sectionId === s.id)
      .map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        currency: i.currency,
        description: i.description || "",
        imageUrl: i.imagePreviewUrl || "",
      })),
  }));
}

export default function OwnerMenu() {
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuSaveError, setMenuSaveError] = useState("");
  const [menuSaveSuccess, setMenuSaveSuccess] = useState("");

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  // Item flow step: 1 = choose section, 2 = item details
  const [itemStep, setItemStep] = useState(1);

  // Add section
  const [newSectionName, setNewSectionName] = useState("");

  // Add item: choose section
  const [selectedSectionId, setSelectedSectionId] = useState("");

  // Add item: details
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCurrency, setItemCurrency] = useState("USD");
  const [itemDesc, setItemDesc] = useState("");
  const [itemImageDataUrl, setItemImageDataUrl] = useState("");

  const [openSectionMenuId, setOpenSectionMenuId] = useState(null);

  // ✅ Edit/Rename section states
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  const [openItemMenuId, setOpenItemMenuId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemImageUrl, setEditingItemImageUrl] = useState("");
  const [returnToItemAfterSection, setReturnToItemAfterSection] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dragState, setDragState] = useState(null);

  useEffect(() => {
    setMenuLoading(true);
    getMyRestaurant()
      .then((restaurant) => {
        const raw = restaurant?.menu_sections ?? restaurant?.menu ?? [];
        const { sections: s, items: i } = normalizeMenuFromApi(raw);
        setSections(s);
        setItems(i);
      })
      .catch(() => {})
      .finally(() => setMenuLoading(false));
  }, []);

  async function saveMenuToBackend() {
    setMenuSaveError("");
    setMenuSaveSuccess("");
    setMenuSaving(true);
    try {
      await updateMyRestaurant({ menu_sections: serializeMenuToApi(sections, items) });
      setMenuSaveSuccess("Menu saved. It will appear for users when they view your restaurant.");
    } catch (err) {
      setMenuSaveError(err.message || "Failed to save menu.");
    } finally {
      setMenuSaving(false);
    }
  }

  const itemImagePreviewUrl = useMemo(
    () => itemImageDataUrl || editingItemImageUrl || "",
    [itemImageDataUrl, editingItemImageUrl]
  );

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to process image."));
      reader.readAsDataURL(file);
    });
  }

  function closeAllMenus() {
    setOpenSectionMenuId(null);
    setOpenItemMenuId(null);
  }

  function startSectionDrag(e, sectionId) {
    closeAllMenus();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sectionId);
    setDragState({ type: "section", id: sectionId });
  }

  function startItemDrag(e, item) {
    closeAllMenus();
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
    setDragState({ type: "item", id: item.id, sectionId: item.sectionId });
  }

  function finishDrag() {
    setDragState(null);
  }

  function allowSectionDrop(e) {
    if (dragState?.type === "section") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }

  function allowItemDrop(e) {
    if (dragState?.type === "item") {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }

  function dropSection(e, overSectionId) {
    if (dragState?.type !== "section") return;
    e.preventDefault();
    setSections((prev) => moveBefore(prev, dragState.id, overSectionId));
    finishDrag();
  }

  function dropItemOnItem(e, overItem) {
    if (dragState?.type !== "item") return;
    e.preventDefault();
    e.stopPropagation();

    setItems((prev) => {
      const moved = prev.map((item) =>
        item.id === dragState.id ? { ...item, sectionId: overItem.sectionId } : item
      );
      return moveBefore(moved, dragState.id, overItem.id);
    });
    finishDrag();
  }

  function dropItemInSection(e, sectionId) {
    if (dragState?.type !== "item") return;
    e.preventDefault();
    e.stopPropagation();

    setItems((prev) => {
      const active = prev.find((item) => item.id === dragState.id);
      if (!active) return prev;

      const withoutActive = prev.filter((item) => item.id !== dragState.id);
      return [...withoutActive, { ...active, sectionId }];
    });
    finishDrag();
  }

  function openAddSection() {
    // ensure we are in "add" mode
    setEditingSectionId(null);
    setEditingSectionName("");
    setNewSectionName("");
    setSectionModalOpen(true);
  }

  function closeAddSection() {
    setSectionModalOpen(false);
    setEditingSectionId(null);
    setEditingSectionName("");
  }

  function addSection(e) {
    e.preventDefault();

    const name = newSectionName.trim();
    if (!name) return;

    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setSections((prev) => [...prev, { id, name }]);

    setSectionModalOpen(false);

    // If we came from item flow, go back automatically
    if (returnToItemAfterSection) {
      setReturnToItemAfterSection(false);

      // Select the new section for the item
      setSelectedSectionId(id);

      // Reopen item modal at step 2 (item details)
      setItemStep(2);
      setItemModalOpen(true);
    }
  }

  // ✅ Rename/Save edited section
  function saveEditedSection(e) {
    e.preventDefault();

    const name = editingSectionName.trim();
    if (!name) return;

    setSections((prev) =>
      prev.map((s) => (s.id === editingSectionId ? { ...s, name } : s))
    );

    setEditingSectionId(null);
    setEditingSectionName("");
    setSectionModalOpen(false);
  }

  function deleteSection(sectionId) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setItems((prev) => prev.filter((it) => it.sectionId !== sectionId));
  }

  function deleteItem(itemId) {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  function openDeleteConfirm(payload) {
    setConfirmDelete(payload);
  }

  function closeDeleteConfirm() {
    setConfirmDelete(null);
  }

  function startEditItem(item) {
    setEditingItemId(item.id);

    setSelectedSectionId(item.sectionId);
    setItemName(item.name);
    setItemPrice(item.price);
    setItemCurrency(item.currency);
    setItemDesc(item.description);
    setItemImageDataUrl("");
    setEditingItemImageUrl(item.imagePreviewUrl || "");
    setItemModalOpen(true);
    setItemStep(2);
  }

  function openAddItem() {
    setEditingItemId(null);
    setItemStep(1);
    setSelectedSectionId("");
    setItemName("");
    setItemPrice("");
    setItemCurrency("USD");
    setItemDesc("");
    setItemImageDataUrl("");
    setEditingItemImageUrl("");
    setItemModalOpen(true);
  }

  async function onPickItemImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const isImage = file.type && file.type.startsWith("image/");
    if (!isImage) {
      alert("Please select an image file (PNG, JPG, JPEG).");
      e.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setItemImageDataUrl(dataUrl);
      setEditingItemImageUrl("");
    } catch (error) {
      alert(error.message || "Failed to process image.");
    }
  }

  function removeItemImage() {
    setItemImageDataUrl("");
    setEditingItemImageUrl("");
  }

  function goToItemDetails(e) {
    e.preventDefault();
    if (!selectedSectionId) return;
    setItemStep(2);
  }

  function saveItem(e) {
    e.preventDefault();

    if (!selectedSectionId) return;
    if (!itemName.trim()) return;
    if (!itemPrice.trim()) return;

    const payload = {
      sectionId: selectedSectionId,
      name: itemName.trim(),
      price: itemPrice.trim(),
      currency: itemCurrency,
      description: itemDesc.trim(),
      imagePreviewUrl: itemImageDataUrl || editingItemImageUrl || "",
    };

    // EDIT mode: update the existing item
    if (editingItemId) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItemId
            ? {
                ...it,
                ...payload,
                imagePreviewUrl: payload.imagePreviewUrl,
              }
            : it
        )
      );

      setEditingItemId(null);
      setEditingItemImageUrl("");
      setItemImageDataUrl("");
      setItemModalOpen(false);
      return;
    }

    // ADD mode: create a new item
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setItems((prev) => [{ id, ...payload }, ...prev]);
    setEditingItemImageUrl("");
    setItemImageDataUrl("");
    setItemModalOpen(false);
  }

  function openAddSectionFromItemFlow() {
    // 1) remember we want to go back to item after creating the section
    setReturnToItemAfterSection(true);

    // 2) close the item modal so the section modal is not hidden behind it
    setItemModalOpen(false);

    // 3) open section modal immediately (ADD MODE)
    setEditingSectionId(null);
    setEditingSectionName("");
    setNewSectionName("");
    setSectionModalOpen(true);
  }

  // ✅ Open rename section modal
  function openRenameSection(section) {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
    setSectionModalOpen(true);
  }

  function closeItemModalAndReset() {
    setItemModalOpen(false);
    setEditingItemId(null);
    setEditingItemImageUrl("");
    setItemImageDataUrl("");
  }

  if (menuLoading) {
    return (
      <div className="ownerMenuPage">
        <p className="menuSectionEmpty" style={{ padding: "20px" }}>Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="ownerMenuPage" onClick={closeAllMenus}>
      <header className="ownerMenuPage__header">
        <h1 className="ownerMenuPage__title">Edit Your Menu</h1>
        <p className="ownerMenuPage__subtitle">
          Organize sections and items so guests can browse your menu quickly.
        </p>
      </header>

      {menuSaveError && <p className="formCard__error" style={{ color: "#f88", marginBottom: 8 }}>{menuSaveError}</p>}
      {menuSaveSuccess && <p className="formCard__success" style={{ color: "#8f8", marginBottom: 8 }}>{menuSaveSuccess}</p>}

      <div className="ownerMenuPage__actions">
        <button
          className="btn btn--ghost ownerMenuPage__actionBtn"
          type="button"
          onClick={openAddSection}
        >
          Add Section
        </button>
        <button
          className="btn btn--gold ownerMenuPage__actionBtn"
          type="button"
          onClick={openAddItem}
        >
          Add Item
        </button>
        <button
          className="btn btn--gold ownerMenuPage__actionBtn"
          type="button"
          onClick={saveMenuToBackend}
          disabled={menuSaving}
        >
          {menuSaving ? "Saving..." : "Save menu"}
        </button>
      </div>

      <div className="ownerMenuSectionsStack">
        {!sections.length && (
          <div className="menuSectionEmpty menuSectionEmpty--page">
            No sections yet. Start by adding a section, then add items.
          </div>
        )}

        {sections.map((s) => {
          const sectionItems = items.filter((it) => it.sectionId === s.id);

          return (
            <div
              className={`menuSectionBlock ${dragState?.type === "section" && dragState.id === s.id ? "is-dragging" : ""}`}
              key={s.id}
              onDragOver={allowSectionDrop}
              onDrop={(e) => dropSection(e, s.id)}
            >
              <div className="menuSectionHeader">
                <div className="ownerMenuSectionInfo">
                  <button
                    className="menuReorderHandle menuReorderHandle--section"
                    type="button"
                    draggable
                    title="Drag section"
                    aria-label={`Drag ${s.name} section`}
                    onDragStart={(e) => startSectionDrag(e, s.id)}
                    onDragEnd={finishDrag}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DragHandIcon />
                  </button>
                  <button className="btn btn--gold ownerMenuSectionBtn">
                    {s.name}
                  </button>
                  <span className="ownerMenuSectionCount">
                    {sectionItems.length} item{sectionItems.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="kebabWrap">
                  <button
                    className="kebabBtn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSectionMenuId((prev) =>
                        prev === s.id ? null : s.id
                      );
                    }}
                  >
                    ⋯
                  </button>

                  {openSectionMenuId === s.id && (
                    <div
                      className="kebabMenu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="kebabItem"
                        type="button"
                        onClick={() => {
                          openRenameSection(s);
                          setOpenSectionMenuId(null);
                        }}
                      >
                        Rename Section
                      </button>

                      <button
                        className="kebabItem kebabItem--danger"
                        type="button"
                        onClick={() => {
                          openDeleteConfirm({
                            title: "Delete section?",
                            message: `Are you sure you want to delete "${s.name}" and all items inside it?`,
                            onConfirm: () => {
                              deleteSection(s.id);
                              closeDeleteConfirm();
                            },
                          });
                          setOpenSectionMenuId(null);
                        }}
                      >
                        Delete Section
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {sectionItems.length > 0 ? (
                <div
                  className="ownerMenuItemsGrid"
                  onDragOver={allowItemDrop}
                  onDrop={(e) => dropItemInSection(e, s.id)}
                >
                  {sectionItems.map((it) => (
                    <div
                      className={`menuItemCard ${dragState?.type === "item" && dragState.id === it.id ? "is-dragging" : ""}`}
                      key={it.id}
                      onDragOver={allowItemDrop}
                      onDrop={(e) => dropItemOnItem(e, it)}
                    >
                      <button
                        className="menuReorderHandle menuReorderHandle--item"
                        type="button"
                        draggable
                        title="Drag item"
                        aria-label={`Drag ${it.name} menu item`}
                        onDragStart={(e) => startItemDrag(e, it)}
                        onDragEnd={finishDrag}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DragHandIcon />
                      </button>

                      <div className="kebabWrap kebabWrap--item">
                        <button
                          className="kebabBtn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenItemMenuId((prev) =>
                              prev === it.id ? null : it.id
                            );
                          }}
                        >
                          ⋯
                        </button>

                        {openItemMenuId === it.id && (
                          <div
                            className="kebabMenu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="kebabItem"
                              type="button"
                              onClick={() => {
                                startEditItem(it);
                                setOpenItemMenuId(null);
                              }}
                            >
                              Edit item
                            </button>

                            <button
                              className="kebabItem kebabItem--danger"
                              type="button"
                              onClick={() => {
                                openDeleteConfirm({
                                  title: "Delete menu item?",
                                  message: `Are you sure you want to delete "${it.name}"?`,
                                  onConfirm: () => {
                                    deleteItem(it.id);
                                    closeDeleteConfirm();
                                  },
                                });
                                setOpenItemMenuId(null);
                              }}
                            >
                              Delete item
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ❌ removed the old minus-delete-mode button */}

                      <div className="menuItemCard__media">
                        {it.imagePreviewUrl ? (
                          <img
                            className="menuItemCard__img"
                            src={it.imagePreviewUrl}
                            alt={it.name}
                          />
                        ) : (
                          <div className="menuItemCard__imgPlaceholder">
                            PNG, JPG, or JPEG
                          </div>
                        )}
                      </div>

                      <div className="menuItemCard__info">
                        <div className="menuItemCard__name">{it.name}</div>
                        <div className="menuItemCard__price">
                          {it.price} {it.currency}
                        </div>
                        {it.description && (
                          <div className="menuItemCard__desc">
                            {it.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="menuSectionEmpty"
                  onDragOver={allowItemDrop}
                  onDrop={(e) => dropItemInSection(e, s.id)}
                >
                  No items in this section yet.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Rename Section Modal */}
      {sectionModalOpen && (
        <div className="modal is-open" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={closeAddSection} />
          <div className="modal__panel" role="document" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal__close"
              type="button"
              onClick={closeAddSection}
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="modal__title">
              {editingSectionId ? "Rename Section" : "Add Section"}
            </h2>
            <p className="modal__subtitle">
              {editingSectionId
                ? "Update the section name."
                : "Create a new menu section (e.g., Starters, Drinks)."}
            </p>

            <form
              className="form"
              onSubmit={editingSectionId ? saveEditedSection : addSection}
            >
              <label className="field">
                <span>Section name</span>
                <input
                  type="text"
                  placeholder="Enter section name"
                  value={editingSectionId ? editingSectionName : newSectionName}
                  onChange={(e) =>
                    editingSectionId
                      ? setEditingSectionName(e.target.value)
                      : setNewSectionName(e.target.value)
                  }
                  required
                />
              </label>

              <button className="btn btn--gold btn--xl" type="submit">
                {editingSectionId ? "Update" : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {itemModalOpen && (
        <div className="modal is-open" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={closeItemModalAndReset} />
          <div className="modal__panel" role="document" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal__close"
              type="button"
              onClick={closeItemModalAndReset}
              aria-label="Close"
            >
              ✕
            </button>

            {itemStep === 1 ? (
              <>
                <h2 className="modal__title">Add Item</h2>
                <p className="modal__subtitle">
                  Choose the section where this item belongs.
                </p>

                <form className="form" onSubmit={goToItemDetails}>
                  <label className="field">
                    <span>Section</span>                    <ThemedSelect
                      value={selectedSectionId}
                      onChange={setSelectedSectionId}
                      options={sections.map((section) => ({
                        value: section.id,
                        label: section.name,
                      }))}
                      placeholder="Select a section"
                      ariaLabel="Select section"
                    />
                  </label>

                  <div className="menuModalHelper">
                    <div className="menuModalHelper__text">
                      Section Not There Yet?
                    </div>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={openAddSectionFromItemFlow}
                    >
                      Add Section
                    </button>
                  </div>

                  <button
                    className="btn btn--gold btn--xl"
                    type="submit"
                    disabled={!sections.length}
                  >
                    Next
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="modal__title">Item Details</h2>
                <p className="modal__subtitle">
                  Fill the information and add an optional image.
                </p>

                <form className="form" onSubmit={saveItem}>
                  <label className="field">
                    <span>Item name</span>
                    <input
                      type="text"
                      placeholder="Enter item name"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      required
                    />
                  </label>

                  <div className="twoCols">
                    <label className="field">
                      <span>Item price</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Enter price"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Currency</span>                      <ThemedSelect
                        value={itemCurrency}
                        onChange={setItemCurrency}
                        options={CURRENCIES.map((currency) => ({
                          value: currency,
                          label: currency,
                        }))}
                        ariaLabel="Select currency"
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Description</span>
                    <input
                      type="text"
                      placeholder="Enter description"
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                    />
                  </label>

                  <div className="imageCard imageCard--equal menuItemImageCard">
                    <div className="imageCard__title">Item image</div>

                    <div className="imageCard__preview imageCard__preview--equal">
                      {itemImagePreviewUrl ? (
                        <>
                          <img
                            className="imageCard__img"
                            src={itemImagePreviewUrl}
                            alt="Item"
                          />
                          <button
                            type="button"
                            className="imageCard__removeBtn imageCard__removeBtn--floating"
                            onClick={removeItemImage}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <div className="imageCard__placeholder">
                          <div className="imageCard__formats">
                            PNG, JPG, or JPEG
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="btn btn--gold imageCard__btn">
                      Upload image
                      <input
                        className="imageCard__input"
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={onPickItemImage}
                      />
                    </label>
                  </div>

                  <div className="menuModalActions">
                    <button
                      className="btn btn--ghost backArrowBtn backArrowBtn--inline"
                      type="button"
                      onClick={() => setItemStep(1)}
                      aria-label="Go back"
                    >
                      ←
                    </button>

                    <button className="btn btn--gold btn--xl" type="submit">
                      Save
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.title || "Delete item?"}
        message={confirmDelete?.message || "Are you sure you want to delete this item?"}
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => confirmDelete?.onConfirm?.()}
        onCancel={closeDeleteConfirm}
      />
    </div>
  );
}
