'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { colors } from '@/lib/tokens';

interface Entity {
  name: string;
  fields?: Array<{
    name: string;
    type: string;
    required?: boolean;
    choices?: string[];
  }>;
  relationships?: Array<{
    type: string;
    target?: string;
    entity?: string;
  }>;
}

interface Spec {
  meta: {
    spec_id: string;
    name: string;
    version: number;
  };
  entities: Entity[];
  anchor?: { entity: string };
}

// Generate sample data for an entity
function generateSampleData(entity: Entity, count: number = 3) {
  const items = [];
  for (let i = 1; i <= count; i++) {
    const item: Record<string, unknown> = { id: i };
    entity.fields?.forEach((field) => {
      switch (field.type) {
        case 'text':
          item[field.name] = `${field.name} ${i}`;
          break;
        case 'email':
          item[field.name] = `user${i}@example.com`;
          break;
        case 'phone':
          item[field.name] = `555-000${i}`;
          break;
        case 'number':
          item[field.name] = i * 10;
          break;
        case 'currency':
          item[field.name] = `$${(i * 25).toFixed(2)}`;
          break;
        case 'date':
          item[field.name] = new Date(2024, i - 1, i * 5).toLocaleDateString();
          break;
        case 'datetime':
          item[field.name] = new Date(2024, i - 1, i * 5, 10 + i, 0).toLocaleString();
          break;
        case 'choice':
          item[field.name] = field.choices?.[i % (field.choices?.length || 1)] || 'Option';
          break;
        case 'toggle':
          item[field.name] = i % 2 === 0;
          break;
        case 'note':
          item[field.name] = `Sample note for item ${i}...`;
          break;
        default:
          item[field.name] = `${field.name} ${i}`;
      }
    });
    items.push(item);
  }
  return items;
}

export default function PreviewPage() {
  const params = useParams();
  const specId = params.specId as string;

  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEntity, setActiveEntity] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    async function loadSpec() {
      try {
        // Fetch spec from API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7130';
        const response = await fetch(`${apiUrl}/functions/get-spec?id=${specId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('App not found. Please generate a new app.');
          } else {
            setError('Failed to load app. Please try again.');
          }
          return;
        }

        const result = await response.json();

        if (!result.success || !result.data?.spec) {
          setError(result.error || 'App not found. Please generate a new app.');
          return;
        }

        const specData = result.data.spec;
        setSpec(specData);

        // Set first entity as active
        if (specData.entities?.length > 0) {
          setActiveEntity(specData.entities[0].name);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load app');
      } finally {
        setLoading(false);
      }
    }

    if (specId) {
      loadSpec();
    }
  }, [specId]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your app...</p>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Unable to load app</h2>
        <p style={styles.errorText}>{error || 'Spec not found'}</p>
        <a href="/" style={styles.backLink}>Create a new app</a>
      </div>
    );
  }

  const activeEntityData = spec.entities.find((e) => e.name === activeEntity);
  const sampleData = activeEntityData ? generateSampleData(activeEntityData) : [];

  return (
    <div style={styles.container}>
      {/* App Header */}
      <header style={styles.header}>
        <h1 style={styles.appName}>{spec.meta.name}</h1>
        <a href="/" style={styles.newAppLink}>+ New App</a>
      </header>

      {/* Navigation Tabs */}
      <nav style={styles.nav}>
        {spec.entities.map((entity) => (
          <button
            key={entity.name}
            onClick={() => {
              setActiveEntity(entity.name);
              setSelectedItem(null);
              setShowForm(false);
            }}
            style={{
              ...styles.navTab,
              ...(activeEntity === entity.name ? styles.navTabActive : {}),
            }}
          >
            {entity.name}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main style={styles.main}>
        {selectedItem ? (
          // Detail View
          <div style={styles.detailView}>
            <button
              onClick={() => setSelectedItem(null)}
              style={styles.backButton}
            >
              ← Back to list
            </button>
            <h2 style={styles.detailTitle}>
              {String(selectedItem[activeEntityData?.fields?.[0]?.name || 'id'] || `${activeEntity} Details`)}
            </h2>
            <div style={styles.detailFields}>
              {activeEntityData?.fields?.map((field) => (
                <div key={field.name} style={styles.detailField}>
                  <label style={styles.fieldLabel}>{field.name}</label>
                  <div style={styles.fieldValue}>
                    {String(selectedItem[field.name] ?? '-')}
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.detailActions}>
              <button style={styles.editButton}>Edit</button>
              <button style={styles.deleteButton}>Delete</button>
            </div>
          </div>
        ) : showForm ? (
          // Add/Edit Form
          <div style={styles.formView}>
            <button
              onClick={() => setShowForm(false)}
              style={styles.backButton}
            >
              ← Cancel
            </button>
            <h2 style={styles.formTitle}>Add {activeEntity}</h2>
            <form style={styles.form} onSubmit={(e) => { e.preventDefault(); setShowForm(false); }}>
              {activeEntityData?.fields?.map((field) => (
                <div key={field.name} style={styles.formField}>
                  <label style={styles.formLabel}>
                    {field.name}
                    {field.required && <span style={styles.required}>*</span>}
                  </label>
                  {field.type === 'choice' ? (
                    <select style={styles.formSelect}>
                      <option value="">Select...</option>
                      {field.choices?.map((choice) => (
                        <option key={choice} value={choice}>{choice}</option>
                      ))}
                    </select>
                  ) : field.type === 'note' ? (
                    <textarea style={styles.formTextarea} rows={3} />
                  ) : field.type === 'toggle' ? (
                    <input type="checkbox" style={styles.formCheckbox} />
                  ) : (
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
                      style={styles.formInput}
                      placeholder={`Enter ${field.name.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
              <button type="submit" style={styles.submitButton}>
                Save {activeEntity}
              </button>
            </form>
          </div>
        ) : (
          // List View
          <div style={styles.listView}>
            <div style={styles.listHeader}>
              <h2 style={styles.listTitle}>{activeEntity}</h2>
              <span style={styles.listCount}>{sampleData.length} items</span>
            </div>
            <div style={styles.list}>
              {sampleData.map((item) => (
                <div
                  key={item.id as number}
                  style={styles.listItem}
                  onClick={() => setSelectedItem(item)}
                >
                  <div style={styles.listItemContent}>
                    <div style={styles.listItemTitle}>
                      {String(item[activeEntityData?.fields?.[0]?.name || 'id'])}
                    </div>
                    {activeEntityData?.fields?.[1] && (
                      <div style={styles.listItemSubtitle}>
                        {String(item[activeEntityData.fields[1].name])}
                      </div>
                    )}
                  </div>
                  <div style={styles.listItemChevron}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FAB */}
      {!selectedItem && !showForm && (
        <button
          style={styles.fab}
          onClick={() => setShowForm(true)}
        >
          +
        </button>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <span style={styles.footerText}>
          Powered by <a href="/" style={styles.footerLink}>KAS</a>
        </span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: `3px solid ${colors.mist}`,
    borderTopColor: colors.stream,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: colors.mist,
    fontSize: '16px',
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '24px',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: colors.clay,
  },
  errorText: {
    color: colors.mist,
    fontSize: '16px',
  },
  backLink: {
    marginTop: '16px',
    color: colors.stream,
    textDecoration: 'underline',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    backgroundColor: colors.stream,
    color: colors.dawn,
  },
  appName: {
    fontSize: '18px',
    fontWeight: 600,
    margin: 0,
  },
  newAppLink: {
    color: colors.dawn,
    opacity: 0.9,
    textDecoration: 'none',
    fontSize: '14px',
  },
  nav: {
    display: 'flex',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    overflowX: 'auto',
    padding: '0 8px',
  },
  navTab: {
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.mist,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  navTabActive: {
    color: colors.stream,
    borderBottomColor: colors.stream,
  },
  main: {
    flex: 1,
    padding: '16px',
    paddingBottom: '80px',
  },
  listView: {},
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  listTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: colors.clay,
    margin: 0,
  },
  listCount: {
    fontSize: '14px',
    color: colors.mist,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: '16px',
    fontWeight: 500,
    color: colors.clay,
    marginBottom: '4px',
  },
  listItemSubtitle: {
    fontSize: '14px',
    color: colors.mist,
  },
  listItemChevron: {
    fontSize: '20px',
    color: '#ccc',
    marginLeft: '12px',
  },
  detailView: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '14px',
    color: colors.stream,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    marginBottom: '16px',
  },
  detailTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: colors.clay,
    marginBottom: '24px',
  },
  detailFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  detailField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fieldLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: colors.mist,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  fieldValue: {
    fontSize: '16px',
    color: colors.clay,
  },
  detailActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '1px solid #e0e0e0',
  },
  editButton: {
    flex: 1,
    padding: '12px',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.stream,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.stream}`,
    borderRadius: '8px',
    cursor: 'pointer',
  },
  deleteButton: {
    flex: 1,
    padding: '12px',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.ember,
    backgroundColor: 'transparent',
    border: `1px solid ${colors.ember}`,
    borderRadius: '8px',
    cursor: 'pointer',
  },
  formView: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: colors.clay,
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: colors.clay,
  },
  required: {
    color: colors.ember,
    marginLeft: '4px',
  },
  formInput: {
    padding: '12px',
    fontSize: '16px',
    border: `1px solid #ddd`,
    borderRadius: '8px',
    outline: 'none',
  },
  formSelect: {
    padding: '12px',
    fontSize: '16px',
    border: `1px solid #ddd`,
    borderRadius: '8px',
    outline: 'none',
    backgroundColor: '#fff',
  },
  formTextarea: {
    padding: '12px',
    fontSize: '16px',
    border: `1px solid #ddd`,
    borderRadius: '8px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  formCheckbox: {
    width: '20px',
    height: '20px',
  },
  submitButton: {
    padding: '14px',
    fontSize: '16px',
    fontWeight: 500,
    color: colors.dawn,
    backgroundColor: colors.stream,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  fab: {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '28px',
    backgroundColor: colors.stream,
    color: colors.dawn,
    border: 'none',
    fontSize: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    cursor: 'pointer',
  },
  footer: {
    padding: '16px',
    textAlign: 'center',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#fff',
  },
  footerText: {
    fontSize: '13px',
    color: colors.mist,
  },
  footerLink: {
    color: colors.stream,
    textDecoration: 'none',
  },
};
