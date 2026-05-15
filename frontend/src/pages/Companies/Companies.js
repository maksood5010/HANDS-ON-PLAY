import "../DeviceGroups/DeviceGroups.css";
import "./Companies.css";
import { useEffect, useState, useContext } from "react";
import { companyAPI, getUploadUrl } from "../../services/api";
import PasswordInput from "../../components/common/PasswordInput";
import ConfirmSheet from "../../components/common/ConfirmSheet/ConfirmSheet";
import { useIsMobile } from "../../hooks/useIsMobile";
import { LayoutTopBarActionContext } from "../../components/Layout/LayoutTopBarActionContext";

function Companies() {
  const openNativePicker = (e) => {
    if (!e?.isTrusted) return;
    const el = e.currentTarget;
    if (!el?.showPicker) return;
    try {
      el.showPicker();
    } catch {
      // ignore gesture errors
    }
  };

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdminCredsModal, setShowAdminCredsModal] = useState(false);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPurchaseDate, setNewPurchaseDate] = useState("");
  const [newPaymentCycle, setNewPaymentCycle] = useState("monthly");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newDeviceLimit, setNewDeviceLimit] = useState(0);
  const [newAdditionalInfo, setNewAdditionalInfo] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminPasswordConfirm, setNewAdminPasswordConfirm] = useState("");
  const [newLogo, setNewLogo] = useState(null);

  const [companyAdminUser, setCompanyAdminUser] = useState(null);
  const [lastResetPassword, setLastResetPassword] = useState("");

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editPaymentCycle, setEditPaymentCycle] = useState("monthly");
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editDeviceLimit, setEditDeviceLimit] = useState(0);
  const [editAdditionalInfo, setEditAdditionalInfo] = useState("");
  const [editLogo, setEditLogo] = useState(null);

  const [mobileView, setMobileView] = useState("list");
  const [confirmCfg, setConfirmCfg] = useState(null);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [createModalError, setCreateModalError] = useState("");
  const [editModalError, setEditModalError] = useState("");

  const isMobile = useIsMobile(1023);
  const setTopBarAction = useContext(LayoutTopBarActionContext);

  const loadCompanies = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await companyAPI.listCompanies();
      const list = res.companies || [];
      setCompanies(list);
      if (!selectedCompany && list.length > 0) {
        setSelectedCompany(list[0]);
      } else if (selectedCompany) {
        const updated = list.find((c) => c.id === selectedCompany.id);
        setSelectedCompany(updated || list[0] || null);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const companyLogoUrl = (c) => {
    const logoPath = c?.logo_path;
    if (!logoPath) return null;
    return getUploadUrl(logoPath);
  };

  const loadSelectedCompanyAdmin = async (companyId) => {
    try {
      const res = await companyAPI.getCompanyAdmin(companyId);
      setCompanyAdminUser(res.adminUser || null);
    } catch {
      setCompanyAdminUser(null);
    }
  };

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileView("list");
  }, [isMobile]);

  useEffect(() => {
    const set = setTopBarAction;
    if (typeof set !== "function") return;
    if (!isMobile || mobileView !== "list") {
      set(null);
      return;
    }
    set(
      <button
        type="button"
        className="mobile-top-bar-add-btn companies-top-add"
        onClick={() => {
          setCreateModalError("");
          setShowCreateModal(true);
        }}
        aria-label="Add company"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    );
    return () => set(null);
  }, [isMobile, mobileView, setTopBarAction]);

  const selectCompany = async (c) => {
    setSelectedCompany(c);
    if (isMobile) setMobileView("detail");
    await loadSelectedCompanyAdmin(c.id);
  };

  const startEdit = (c) => {
    setEditModalError("");
    setEditId(c.id);
    setEditName(c.name || "");
    setEditPurchaseDate(c.purchase_date ? String(c.purchase_date).slice(0, 10) : "");
    setEditPaymentCycle(c.payment_cycle || "monthly");
    setEditContactName(c.contact_name || "");
    setEditContactEmail(c.contact_email || "");
    setEditContactPhone(c.contact_phone || "");
    setEditDeviceLimit(typeof c.device_limit === "number" ? c.device_limit : 0);
    setEditAdditionalInfo(c.additional_info || "");
    setEditLogo(null);
    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setEditModalError("");
    setEditId(null);
    setEditName("");
    setEditPurchaseDate("");
    setEditPaymentCycle("monthly");
    setEditContactName("");
    setEditContactEmail("");
    setEditContactPhone("");
    setEditDeviceLimit(0);
    setEditAdditionalInfo("");
    setEditLogo(null);
    setShowEditModal(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateModalError("");
    const slug = newSlug.trim();
    if (!slug) {
      setCreateModalError("Company slug is required");
      return;
    }
    setCreatingCompany(true);
    try {
      await companyAPI.createCompany({
        name: newName.trim(),
        slug,
        purchase_date: newPurchaseDate,
        payment_cycle: newPaymentCycle,
        contact_name: newContactName.trim() || undefined,
        contact_email: newContactEmail.trim() || undefined,
        contact_phone: newContactPhone.trim() || undefined,
        device_limit: Number(newDeviceLimit) || 0,
        additional_info: newAdditionalInfo.trim() || undefined,
        admin: { username: newAdminUsername.trim(), password: newAdminPassword },
        logo: newLogo,
      });
      setNewName("");
      setNewSlug("");
      setNewPurchaseDate("");
      setNewPaymentCycle("monthly");
      setNewContactName("");
      setNewContactEmail("");
      setNewContactPhone("");
      setNewDeviceLimit(0);
      setNewAdditionalInfo("");
      setNewAdminUsername("");
      setNewAdminPassword("");
      setNewAdminPasswordConfirm("");
      setNewLogo(null);
      setShowCreateModal(false);
      await loadCompanies();
    } catch (err) {
      setCreateModalError(err.response?.data?.error || "Failed to create company");
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleSave = async () => {
    setEditModalError("");
    try {
      const fields = {
        name: editName.trim(),
        purchase_date: editPurchaseDate,
        payment_cycle: editPaymentCycle,
        contact_name: editContactName.trim() || null,
        contact_email: editContactEmail.trim() || null,
        contact_phone: editContactPhone.trim() || null,
        device_limit: Number(editDeviceLimit) || 0,
        additional_info: editAdditionalInfo.trim() || null,
      };
      if (editLogo) fields.logo = editLogo;
      await companyAPI.updateCompany(editId, fields);
      cancelEdit();
      await loadCompanies();
    } catch (err) {
      setEditModalError(err.response?.data?.error || "Failed to update company");
    }
  };

  const runDeleteCompany = async (c) => {
    setError("");
    try {
      await companyAPI.deleteCompany(c.id);
      if (selectedCompany?.id === c.id) {
        setSelectedCompany(null);
        setMobileView("list");
      }
      await loadCompanies();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete company");
    }
  };

  const requestDeleteCompany = (c) => {
    setConfirmCfg({
      title: "Delete company",
      message: `Delete company "${c.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        await runDeleteCompany(c);
        setConfirmCfg(null);
      },
    });
  };

  const requestResetAdminPassword = () => {
    const adminLabel = companyAdminUser?.username || "admin";
    setConfirmCfg({
      title: "Reset admin password",
      message: `Reset password for company admin "${adminLabel}"?`,
      confirmLabel: "Reset password",
      danger: true,
      onConfirm: async () => {
        setError("");
        try {
          const res = await companyAPI.resetCompanyAdminPassword(selectedCompany.id);
          setCompanyAdminUser(res.adminUser || companyAdminUser);
          setLastResetPassword(res.tempPassword || "");
          setShowAdminCredsModal(true);
        } catch (err) {
          setError(err.response?.data?.error || "Failed to reset admin password");
        } finally {
          setConfirmCfg(null);
        }
      },
    });
  };

  const copyToClipboard = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError(`Could not copy ${label}`);
    }
  };

  const listHiddenClass = isMobile && mobileView === "detail" ? " is-hidden-mobile" : "";
  const detailHiddenClass = isMobile && mobileView === "list" ? " is-hidden-mobile" : "";

  return (
    <div className="device-groups-page companies-page">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Companies</h1>
            <p>Platform super-admin: manage all companies</p>
          </div>
          <button
            className="create-btn create-btn-desktop-only"
            type="button"
            onClick={() => {
              setCreateModalError("");
              setShowCreateModal(true);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Company
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <div className="device-groups-container">
        <div className={`device-groups-list${listHiddenClass}`}>
          <h2>All Companies</h2>
          {loading ? (
            <div className="loading">Loading companies...</div>
          ) : companies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 21h18"></path>
                  <path d="M5 21V7l8-4 8 4v14"></path>
                  <path d="M9 21v-8h6v8"></path>
                </svg>
              </div>
              <p>No companies yet. Create your first company to get started.</p>
            </div>
          ) : (
            <div className="group-cards">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className={`group-card ${selectedCompany?.id === c.id ? "active" : ""}`}
                  onClick={() => selectCompany(c)}
                >
                  <div className="group-card-header">
                    {companyLogoUrl(c) ? (
                      <img
                        className="company-logo company-logo--list"
                        src={companyLogoUrl(c)}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="group-icon-wrapper">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 21h18"></path>
                          <path d="M5 21V7l8-4 8 4v14"></path>
                          <path d="M9 21v-8h6v8"></path>
                        </svg>
                      </div>
                    )}
                    <button
                      className="delete-btn-small"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeleteCompany(c);
                      }}
                      title="Delete company"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  <h3>{c.name}</h3>
                  <div className="group-meta">
                    <span className="device-count-badge">ID: {c.id}</span>
                    {c.slug && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="companies-slug">{c.slug}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`group-detail${detailHiddenClass}`}>
          {selectedCompany ? (
            <>
              {isMobile && mobileView === "detail" && (
                <div className="group-detail-back-bar">
                  <button type="button" className="group-detail-back" onClick={() => setMobileView("list")}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Companies</span>
                  </button>
                </div>
              )}
              <div className="detail-header">
                <div className="detail-title-row">
                  {companyLogoUrl(selectedCompany) ? (
                    <img
                      className="company-logo company-logo--detail"
                      src={companyLogoUrl(selectedCompany)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="detail-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18"></path>
                        <path d="M5 21V7l8-4 8 4v14"></path>
                        <path d="M9 21v-8h6v8"></path>
                      </svg>
                    </div>
                  )}
                  <div>
                    <h2>{selectedCompany.name}</h2>
                    <span className="global-indicator">
                      Company ID: {selectedCompany.id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-content">
                <div className="detail-section">
                  <h3>Company Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Company ID</span>
                      <span className="info-value">{selectedCompany.id}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Name</span>
                      <span className="info-value">{selectedCompany.name}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Slug</span>
                      <span className="info-value">{selectedCompany.slug || "—"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Purchase date</span>
                      <span className="info-value">
                        {selectedCompany.purchase_date
                          ? new Date(selectedCompany.purchase_date).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Payment cycle</span>
                      <span className="info-value">{selectedCompany.payment_cycle || "—"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Device limit</span>
                      <span className="info-value">
                        {selectedCompany.device_limit > 0 ? selectedCompany.device_limit : "Unlimited"}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Contact name</span>
                      <span className="info-value">{selectedCompany.contact_name || "—"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Contact email</span>
                      <span className="info-value">{selectedCompany.contact_email || "—"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Contact phone</span>
                      <span className="info-value">{selectedCompany.contact_phone || "—"}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Additional info</span>
                      <span className="info-value">{selectedCompany.additional_info || "—"}</span>
                    </div>
                    {selectedCompany.created_at && (
                      <div className="info-item">
                        <span className="info-label">Created</span>
                        <span className="info-value">
                          {new Date(selectedCompany.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Actions</h3>
                  <p className="section-description">Edit company details (slug cannot be changed).</p>
                  <button
                    className="edit-group-btn"
                    type="button"
                    onClick={() => startEdit(selectedCompany)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit Company
                  </button>
                </div>

                <div className="detail-section">
                  <h3>Company Admin Login</h3>
                  <p className="section-description">
                    Username is visible; passwords are not stored in plain text. Use reset to generate a new password.
                  </p>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Admin username</span>
                      <span className="info-value">{companyAdminUser?.username || "—"}</span>
                    </div>
                  </div>
                  <div className="companies-admin-actions">
                    <button
                      className="edit-group-btn"
                      type="button"
                      onClick={requestResetAdminPassword}
                      disabled={!selectedCompany?.id}
                    >
                      Reset admin password
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-detail">
              <div className="empty-detail-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 21h18"></path>
                  <path d="M5 21V7l8-4 8 4v14"></path>
                  <path d="M9 21v-8h6v8"></path>
                </svg>
                <p>Select a company to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!creatingCompany) {
              setCreateModalError("");
              setShowCreateModal(false);
            }
          }}
        >
          <div
            className="modal-content modal-content-large modal-content--stacked companies-company-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Add Company</h2>
              <button
                type="button"
                className="close-btn"
                disabled={creatingCompany}
                onClick={() => {
                  setCreateModalError("");
                  setShowCreateModal(false);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {createModalError && (
              <div className="companies-modal-error" role="alert">
                <span className="companies-modal-error__text">{createModalError}</span>
                <button
                  type="button"
                  className="companies-modal-error__dismiss"
                  onClick={() => setCreateModalError("")}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
            <form
              onSubmit={handleCreate}
              autoComplete="off"
              className="modal-form-stack"
              aria-busy={creatingCompany}
            >
              <div className="modal-body-scroll">
              <fieldset className="companies-modal-fieldset" disabled={creatingCompany}>
              <div className="companies-form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="company_name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Acme Inc"
                  required
                  autoFocus
                />
                <small>Displayed company name</small>
              </div>
              <div className="form-group">
                <label>Slug *</label>
                <input
                  type="text"
                  name="company_slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g., acme-inc"
                  required
                />
                <small>Lowercase letters/numbers with dashes</small>
              </div>
              <div className="form-group">
                <label>Purchase date *</label>
                <input
                  type="date"
                  name="company_purchase_date"
                  value={newPurchaseDate}
                  onChange={(e) => setNewPurchaseDate(e.target.value)}
                  onClick={openNativePicker}
                  required
                />
              </div>
              <div className="form-group">
                <label>Payment cycle *</label>
                <select
                  name="company_payment_cycle"
                  value={newPaymentCycle}
                  onChange={(e) => setNewPaymentCycle(e.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
              <div className="form-group">
                <label>Contact name (optional)</label>
                <input
                  type="text"
                  name="company_contact_name"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Contact email (optional)</label>
                <input
                  type="email"
                  name="company_contact_email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Contact phone (optional)</label>
                <input
                  type="tel"
                  name="company_contact_phone"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Device limit *</label>
                <input
                  type="number"
                  name="company_device_limit"
                  min="0"
                  value={newDeviceLimit}
                  onChange={(e) => setNewDeviceLimit(e.target.value)}
                />
                <small>0 means unlimited</small>
              </div>
              <div className="form-group companies-full">
                <label>Additional information (optional)</label>
                <input
                  type="text"
                  name="company_additional_info"
                  value={newAdditionalInfo}
                  onChange={(e) => setNewAdditionalInfo(e.target.value)}
                />
              </div>
              <div className="form-group companies-full">
                <span className="companies-field-label">Company logo (optional)</span>
                <div className="companies-logo-field">
                  <label className="companies-logo-upload">
                    <span className="companies-logo-upload__btn" tabIndex={-1}>
                      Choose image
                    </span>
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setNewLogo(e.target.files?.[0] || null)}
                    />
                  </label>
                  {newLogo && (
                    <div className="companies-logo-picked">
                      <span className="companies-logo-picked__name" title={newLogo.name}>
                        {newLogo.name}
                      </span>
                      <button type="button" className="companies-logo-remove" onClick={() => setNewLogo(null)}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <small>Used as the placeholder image on devices when no playlist is active</small>
              </div>
              <div className="form-group">
                <label>Admin username *</label>
                <input
                  type="text"
                  name="company_admin_username"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group companies-full">
                <label>Admin password *</label>
                <PasswordInput
                  name="company_admin_password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                <small>At least 6 characters</small>
              </div>
              <div className="form-group companies-full">
                <label>Retype admin password *</label>
                <PasswordInput
                  name="company_admin_password_confirm"
                  value={newAdminPasswordConfirm}
                  onChange={(e) => setNewAdminPasswordConfirm(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                {newAdminPasswordConfirm && newAdminPasswordConfirm !== newAdminPassword && (
                  <small style={{ color: "#dc2626" }}>Passwords do not match</small>
                )}
              </div>
              </div>
              </fieldset>
              </div>
              <div className="modal-actions modal-actions-footer">
                <button
                  type="button"
                  className="cancel-btn"
                  disabled={creatingCompany}
                  onClick={() => {
                    setCreateModalError("");
                    setShowCreateModal(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn companies-create-submit"
                  disabled={
                    creatingCompany ||
                    !newAdminPassword ||
                    !newAdminPasswordConfirm ||
                    newAdminPasswordConfirm !== newAdminPassword
                  }
                >
                  {creatingCompany && (
                    <span className="companies-btn-spinner" aria-hidden="true" />
                  )}
                  {creatingCompany ? "Creating…" : "Create Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedCompany && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div
            className="modal-content modal-content-large modal-content--stacked companies-company-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Edit Company</h2>
              <button type="button" className="close-btn" onClick={cancelEdit}>×</button>
            </div>
            {editModalError && (
              <div className="companies-modal-error" role="alert">
                <span className="companies-modal-error__text">{editModalError}</span>
                <button
                  type="button"
                  className="companies-modal-error__dismiss"
                  onClick={() => setEditModalError("")}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
            <form
              className="modal-form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div className="modal-body-scroll">
              <div className="companies-form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Purchase date *</label>
                <input
                  type="date"
                  value={editPurchaseDate}
                  onChange={(e) => setEditPurchaseDate(e.target.value)}
                  onClick={openNativePicker}
                  required
                />
              </div>
              <div className="form-group">
                <label>Payment cycle *</label>
                <select value={editPaymentCycle} onChange={(e) => setEditPaymentCycle(e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
              <div className="form-group">
                <label>Contact name (optional)</label>
                <input
                  type="text"
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Contact email (optional)</label>
                <input
                  type="email"
                  value={editContactEmail}
                  onChange={(e) => setEditContactEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Contact phone (optional)</label>
                <input
                  type="tel"
                  value={editContactPhone}
                  onChange={(e) => setEditContactPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Device limit *</label>
                <input
                  type="number"
                  min="0"
                  value={editDeviceLimit}
                  onChange={(e) => setEditDeviceLimit(e.target.value)}
                />
                <small>0 means unlimited</small>
              </div>
              <div className="form-group companies-full">
                <label>Additional information (optional)</label>
                <input
                  type="text"
                  value={editAdditionalInfo}
                  onChange={(e) => setEditAdditionalInfo(e.target.value)}
                />
              </div>
              <div className="form-group companies-full">
                <span className="companies-field-label">Company logo (optional)</span>
                <div className="companies-logo-field">
                  <label className="companies-logo-upload">
                    <span className="companies-logo-upload__btn" tabIndex={-1}>
                      Choose image
                    </span>
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditLogo(e.target.files?.[0] || null)}
                    />
                  </label>
                  {editLogo && (
                    <div className="companies-logo-picked">
                      <span className="companies-logo-picked__name" title={editLogo.name}>
                        {editLogo.name}
                      </span>
                      <button type="button" className="companies-logo-remove" onClick={() => setEditLogo(null)}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <small>Select a new logo to replace the current one</small>
              </div>
              </div>
              </div>
              <div className="modal-actions modal-actions-footer">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdminCredsModal && (
        <div className="modal-overlay" onClick={() => setShowAdminCredsModal(false)}>
          <div className="modal-content companies-admin-creds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Admin credentials (copy now)</h2>
              <button type="button" className="close-btn" onClick={() => setShowAdminCredsModal(false)}>×</button>
            </div>
            <div className="detail-section companies-admin-creds-body">
              <p className="section-description">
                This password is shown only once. After closing, you’ll need to reset again to get a new one.
              </p>
              <div className="companies-creds-block">
                <span className="companies-creds-label">Username</span>
                <div className="companies-creds-row">
                  <code className="companies-creds-value">{companyAdminUser?.username || "—"}</code>
                  <button
                    type="button"
                    className="companies-copy-btn"
                    onClick={() => copyToClipboard(companyAdminUser?.username, "username")}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="companies-creds-block">
                <span className="companies-creds-label">Temporary password</span>
                <div className="companies-creds-row companies-creds-row--password">
                  <pre className="companies-creds-password">{lastResetPassword || "—"}</pre>
                  <button
                    type="button"
                    className="companies-copy-btn"
                    onClick={() => copyToClipboard(lastResetPassword, "password")}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="submit-btn"
                onClick={() => setShowAdminCredsModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={Boolean(confirmCfg)}
        title={confirmCfg?.title || "Confirm"}
        message={confirmCfg?.message || ""}
        confirmLabel={confirmCfg?.confirmLabel || "OK"}
        danger={confirmCfg?.danger}
        onClose={() => setConfirmCfg(null)}
        onConfirm={confirmCfg?.onConfirm || (async () => {})}
      />
    </div>
  );
}

export default Companies;

