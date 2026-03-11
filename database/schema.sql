/* ================================================================================================================================
  Script de criação do schema do banco de dados utilizado para armazenar os dados processados e as pendências geradas.
  ================================================================================================================================= 
*/
-- Alunos Aptos para rematrícula
hive_metastore.sb_jira.alunos_aptos (
  cod_aluno decimal(10,0) NOT NULL,
  cod_pessoa decimal(10,0) NOT NULL,
  num_cpf STRING NOT NULL,
  num_matricula STRING NOT NULL,
  nom_aluno STRING NOT NULL,
  cod_curso decimal(10,0) NOT NULL,
  cod_tpo_grade decimal(10,0) NOT NULL,
  cod_cat_grade decimal(10,0) NOT NULL,
  cod_sta_aluno decimal(10,0) NOT NULL,
  cod_instituicao decimal(10,0) NOT NULL,  
  ind_calouro BOOLEAN NOT NULL,
  ind_formando BOOLEAN NOT NULL,
  cod_ass_contrato decimal(10,0),
  cod_periodo_letivo_atual decimal(10,0) NOT NULL,
  
  -- indicadores preocessamento
  ind_aptos BOOLEAN COMMENT 'true=já já tem aluno_periodo_letivo',
  
  data_aptos TIMESTAMP,

  ind_liberado_financeiro BOOLEAN COMMENT 'true=contrato financeiro liberado pagou ou liberacao especial',
  ind_aceite_contrato BOOLEAN COMMENT 'true=aceitou contrato matricula',
  data_criacao TIMESTAMP,
  ind_alterado BOOLEAN
  
)

-- Tipos de pendencias
hive_metastore.sb_jira.tipo_pendencia (  
  id SMALLINT NOT NULL,
  slug STRING NOT NULL,
  nom_pendencia STRING NOT NULL,
  dsc_pendencia STRING DEFAULT NULL,
  tabela STRING COMMENT 'Tabela que armazena o id de referencia da pendencia',
  ind_prerematricula BOOLEAN DEFAULT false,
  ind_ativo BOOLEAN DEFAULT true  
)

INSERT INTO hive_metastore.sb_jira.tipo_pendencia (id, slug, nom_pendencia, dsc_pendencia, tabela, ind_prerematricula) 
VALUES 
  (1,  'aptos',                        'Não apto',                              'Não gerou aluno periodo letivo',           'ALUNO', true),
  (2,  'persona',                      'Aluno sem persona',                     'Não gerou persona',                        'ALUNO', true),
  (3,  'turma_vaga',                   'Turma vaga negativa',                   'Turma vaga negativa',                      'TURMA', true),
  (4,  'turma_cho_imcompleta',         'Turma carga horária incompleta',        'Turma carga horária incompleta',           'TURMA', true),
  (5,  'curso_evento',                 'Curso sem Evento',                      'Curso sem Evento',                         'CURSO', true),
  (6,  'curso_contrato_financeiro',    'Curso sem Contrato Financeiro',         'Curso sem Contrato Financeiro',            'CURSO', true),
  (7,  'curso_processo',               'Curso sem Processo',                    'Curso sem Processo Matricula',             'CURSO', true),
  (8,  'aluno_contrato_financeiro',    'Aluno sem Contrato Financeiro Liberado','Aluno sem Contrato Financeiro Liberado',   'ALUNO', false),
  (9, 'aluno_liberacao_disciplina',   'Aluno sem Disciplina Liberada',         'Aluno sem Disciplina Liberada',            'ALUNO', false),
  (10, 'aluno_confirmacao_disciplina', 'Aluno sem Disciplina Confirmada',       'Aluno sem Disciplina Confirmada',          'ALUNO', false),
  (11, 'aluno_disciplina_oferta',      'Aluno sem Disciplina Oferta',           'Aluno sem Disciplina Oferta',              'ALUNO', true);


-- Pendencias gerais
  hive_metastore.sb_jira.pendencias (  
  id BIGINT GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
  id_tpo_pendencia SMALLINT NOT NULL,
  data_pendencia TIMESTAMP NOT NULL,
  cod_valor_referencia decimal(10,0) COMMENT 'Valor referencia da pendencia, cod_aluno se aluno, cod_curso se curso, cod_turma se turma ...',
  valor_referencia STRING, -- valor adicional se necessário 
  -- indicadores preocessamento
  data_pendencia_removida TIMESTAMP,
  ind_ativo BOOLEAN COMMENT 'true=pendencia ativa, false=pendencia aconteceu mas não está mais ativa'
)

-- Impacto de Pendencias no aluno
hive_metastore.sb_jira.aluno_pendencias (  
  cod_pessoa decimal(10,0) NOT NULL,
  id_pendencia INT NOT NULL COMMENT 'Referencia da tabela pendencias',
  id_tpo_pendencia SMALLINT NOT NULL, -- dado replicado pra facil consulta, um join a menos
  -- indicadores preocessamento
  data_processamento TIMESTAMP NOT NULL,
  ind_ativo BOOLEAN COMMENT 'true=pendencia ativa, false=pendencia aconteceu mas não está mais ativa'
)