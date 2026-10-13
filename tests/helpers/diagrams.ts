import type { ProjectDiagrams } from '../../shared/types/diagrams'

export function projectDiagrams(): ProjectDiagrams {
  const field = (id: string, name: string, primaryKey = false) => ({ id, name, type: { id: 'uuid', name: 'uuid' }, primaryKey, nullable: false, unique: primaryKey, createdAt: 0 })
  return {
    database: JSON.stringify({
      id: 'schema', name: 'Architecture client', databaseType: 'postgresql', createdAt: 0, updatedAt: 0,
      tables: [
        { id: 'customers', name: 'clients', x: 0, y: 0, fields: [field('customer-id', 'id', true)], indexes: [], color: '#6867f6', isView: false, createdAt: 0 },
        { id: 'projects', name: 'projets', x: 400, y: 100, fields: [field('project-id', 'id', true), field('project-customer', 'client_id')], indexes: [], color: '#6867f6', isView: false, createdAt: 0 }
      ],
      relationships: [{ id: 'relation', name: 'client_projects', sourceTableId: 'projects', targetTableId: 'customers', sourceFieldId: 'project-customer', targetFieldId: 'customer-id', sourceCardinality: 'many', targetCardinality: 'one', createdAt: 0 }]
    }),
    wbs: [
      { id: 'design', parentId: null, label: 'Conception' },
      { id: 'specification', parentId: 'design', label: 'Rédiger le cahier des charges' },
      { id: 'delivery', parentId: null, label: 'Livraison' }
    ]
  }
}
