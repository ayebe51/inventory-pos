export interface PermissionDefinition {
  module: string;
  action: string;
  description: string;
}

/**
 * Single source of truth for every permission string enforced via
 * @RequirePermissions across controllers. The RBAC seed must always
 * define and assign these; dto-contract-style regression test
 * (permission-completeness.spec.ts) fails the build if a controller
 * starts requiring a permission that is absent here.
 */
export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Purchase
  { module: 'PURCHASE', action: 'READ', description: 'View purchase documents' },
  { module: 'PURCHASE', action: 'CREATE', description: 'Create purchase requests and orders' },
  { module: 'PURCHASE', action: 'UPDATE', description: 'Update purchase documents' },
  { module: 'PURCHASE', action: 'DELETE', description: 'Delete purchase documents' },
  { module: 'PURCHASE', action: 'APPROVE', description: 'Approve purchase orders' },
  // Inventory
  { module: 'INVENTORY', action: 'READ', description: 'View inventory data' },
  { module: 'INVENTORY', action: 'CREATE', description: 'Create inventory records' },
  { module: 'INVENTORY', action: 'UPDATE', description: 'Update inventory records' },
  { module: 'INVENTORY', action: 'DELETE', description: 'Delete inventory records' },
  // Sales
  { module: 'SALES', action: 'READ', description: 'View sales documents' },
  { module: 'SALES', action: 'CREATE', description: 'Create sales orders' },
  { module: 'SALES', action: 'UPDATE', description: 'Update sales documents' },
  { module: 'SALES', action: 'DELETE', description: 'Delete sales documents' },
  { module: 'SALES', action: 'APPROVE', description: 'Approve sales orders' },
  { module: 'SALES', action: 'FULFILL', description: 'Fulfill approved sales orders' },
  { module: 'SALES', action: 'RETURN', description: 'Process sales returns' },
  // POS
  { module: 'POS', action: 'READ', description: 'View POS transactions' },
  { module: 'POS', action: 'CREATE', description: 'Create POS transactions' },
  { module: 'POS', action: 'UPDATE', description: 'Open/close shifts and update transactions' },
  { module: 'POS', action: 'DELETE', description: 'Void POS transactions' },
  // Invoice
  { module: 'INVOICE', action: 'READ', description: 'View invoices' },
  { module: 'INVOICE', action: 'VIEW', description: 'View invoice details and listings' },
  { module: 'INVOICE', action: 'CREATE', description: 'Create invoices' },
  { module: 'INVOICE', action: 'UPDATE', description: 'Update invoices' },
  { module: 'INVOICE', action: 'POST', description: 'Post invoices' },
  { module: 'INVOICE', action: 'WRITE_OFF', description: 'Write off uncollectible AR invoices' },
  // Payment
  { module: 'PAYMENT', action: 'READ', description: 'View payments' },
  { module: 'PAYMENT', action: 'CREATE', description: 'Create payments' },
  { module: 'PAYMENT', action: 'APPROVE', description: 'Approve payments (SoD enforced)' },
  { module: 'PAYMENT', action: 'POST', description: 'Post payments' },
  { module: 'PAYMENT', action: 'REVERSE', description: 'Reverse posted payments' },
  // Accounting
  { module: 'ACCOUNTING', action: 'READ', description: 'View journal entries and COA' },
  { module: 'ACCOUNTING', action: 'CREATE', description: 'Create manual journal entries' },
  { module: 'ACCOUNTING', action: 'UPDATE', description: 'Update draft journal entries' },
  { module: 'ACCOUNTING', action: 'DELETE', description: 'Delete chart of accounts entries' },
  // Period & Journal
  { module: 'PERIOD', action: 'VIEW', description: 'View fiscal periods' },
  { module: 'PERIOD', action: 'CREATE', description: 'Create fiscal periods' },
  { module: 'PERIOD', action: 'CLOSE', description: 'Close fiscal periods' },
  { module: 'JOURNAL', action: 'VIEW', description: 'View journal entry listings' },
  { module: 'JOURNAL', action: 'CREATE', description: 'Create journal entries' },
  { module: 'JOURNAL', action: 'REVERSE', description: 'Reverse posted journal entries' },
  // Finance
  { module: 'FINANCE', action: 'MANAGE', description: 'Manage finance configuration' },
  // Stock operations
  { module: 'STOCK', action: 'ADJUST', description: 'Perform manual stock adjustments' },
  { module: 'STOCK', action: 'OPNAME', description: 'Initiate and finalize stock opname' },
  { module: 'STOCK', action: 'TRANSFER', description: 'Transfer stock between warehouses' },
  // Reports
  { module: 'REPORT', action: 'FINANCIAL', description: 'Access financial reports' },
  { module: 'REPORT', action: 'EXECUTIVE', description: 'Access executive dashboard' },
  // Admin
  { module: 'ADMIN', action: 'SETTINGS', description: 'Modify system settings' },
  { module: 'ADMIN', action: 'USER', description: 'Manage users and roles' },
  // Master data products
  { module: 'PRODUCT', action: 'CREATE', description: 'Create products and related master data' },
  { module: 'PRODUCT', action: 'UPDATE', description: 'Update products and related master data' },
  { module: 'PRODUCT', action: 'DELETE', description: 'Delete products and related master data' },
];

export const PERMISSION_KEYS: string[] = PERMISSION_DEFINITIONS.map(
  (p) => `${p.module}.${p.action}`,
);
