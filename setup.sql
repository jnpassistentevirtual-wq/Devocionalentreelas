-- =====================================================================
-- ESTUDO BÍBLICO PARA MULHERES — Configuração do banco de dados (Supabase)
-- Rode este script inteiro no SQL Editor do seu projeto Supabase
-- (Menu lateral → SQL Editor → New query → cole tudo → Run)
-- =====================================================================

-- 1) TABELA: entradas diárias pessoais (o diário de cada mulher)
create table if not exists daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  day int not null,
  resumo text default '',
  ensinou text default '',
  familia text default '',
  maternidade text default '',
  negocios text default '',
  casamento text default '',
  oracao text default '',
  versiculo text default '',
  desafio text default '',
  nota int default 0,
  updated_at timestamptz default now(),
  unique (user_id, book_id, day)
);

alter table daily_entries enable row level security;

create policy "Cada mulher vê e edita só as próprias respostas"
  on daily_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) TABELA: recado da semana (mural)
create table if not exists mural_announcement (
  id int primary key default 1,
  text text default '',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into mural_announcement (id, text) values (1, '') on conflict (id) do nothing;

alter table mural_announcement enable row level security;

create policy "Qualquer pessoa logada pode ler o recado"
  on mural_announcement for select
  using (auth.role() = 'authenticated');

create policy "Qualquer pessoa logada pode editar o recado"
  on mural_announcement for update
  using (auth.role() = 'authenticated');

-- 3) TABELA: comentários do mural
create table if not exists mural_comments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  created_at timestamptz default now()
);

alter table mural_comments enable row level security;

create policy "Qualquer pessoa logada pode ler e postar comentários"
  on mural_comments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4) TABELA: pedidos de oração
create table if not exists mural_prayers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  pray_count int default 0,
  created_at timestamptz default now()
);

alter table mural_prayers enable row level security;

create policy "Qualquer pessoa logada pode ler e postar orações"
  on mural_prayers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 5) TABELA: testemunhos
create table if not exists mural_testimonies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  created_at timestamptz default now()
);

alter table mural_testimonies enable row level security;

create policy "Qualquer pessoa logada pode ler e postar testemunhos"
  on mural_testimonies for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 6) TABELA: sugestões de louvor
create table if not exists mural_worship (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  created_at timestamptz default now()
);

alter table mural_worship enable row level security;

create policy "Qualquer pessoa logada pode ler e postar louvores"
  on mural_worship for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 7) TABELA: orações prontas por área (editável pelo grupo)
create table if not exists mural_prayer_topics (
  id int primary key,
  icon text,
  title text,
  prayer text,
  updated_at timestamptz default now()
);

alter table mural_prayer_topics enable row level security;

create policy "Qualquer pessoa logada pode ler e ajustar orações por área"
  on mural_prayer_topics for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Popula as 8 orações iniciais (só roda se a tabela estiver vazia)
insert into mural_prayer_topics (id, icon, title, prayer)
values
  (0, '💍', 'Casamento', 'Senhor, Tu conheces cada detalhe do meu casamento — as alegrias e também o que ainda dói. Ensina-me a amar com paciência, a perdoar rápido e a ser parceira, não adversária. Cura as feridas que ainda carregamos, meu esposo e eu, e nos ajuda a construir um lar sobre a Tua fidelidade, não sobre nossas forças. Que nosso casamento aponte para o Teu amor.'),
  (1, '🍼', 'Filhos e Maternidade', 'Pai, entrego meus filhos em Tuas mãos — o corpo, o coração e o futuro deles. Dá-me sabedoria para educar com amor e limites, paciência para os dias difíceis e alegria para celebrar cada pequena vitória. Protege-os do que eu não consigo ver, e planta neles, desde cedo, o desejo de Te conhecer.'),
  (2, '💰', 'Finanças', 'Senhor, Tu és o dono de tudo o que tenho. Ajuda-me a administrar com sabedoria e integridade, sem ansiedade pelo que falta nem apego pelo que sobra. Provê para as necessidades da minha casa e do meu trabalho, e ensina-me a ser generosa, confiando que Tu sempre sustentas quem Te honra.'),
  (3, '🩺', 'Saúde e Cura', 'Deus que cura, coloco diante de Ti minha saúde e a de quem eu amo. Tu conheces cada exame, cada diagnóstico, cada dor que ainda não tem explicação. Peço Tua cura, e também Tua paz enquanto ela não chega por completo. Fortalece meu corpo e minha fé, e me lembra que Tu estás no controle, mesmo quando o médico não tem todas as respostas.'),
  (4, '😰', 'Ansiedade e Medo', 'Senhor, meu coração está acelerado e minha mente não para. Ajuda-me a entregar a Ti o que não controlo, e a respirar fundo sabendo que Tu já estás no amanhã que eu tanto temo. Troca minha ansiedade por Tua paz, que excede todo entendimento. Que eu descanse hoje em Ti, um passo de cada vez.'),
  (5, '🕊️', 'Perdão', 'Pai, há uma dor em mim que preciso entregar a Ti. Ensina-me a perdoar — não porque a dor não importou, mas porque quero ser livre dela. Cura o que ainda sangra por dentro, e me ajuda a não deixar essa mágoa definir quem eu sou. Que eu também receba o perdão que preciso, inclusive de mim mesma.'),
  (6, '💼', 'Trabalho e Propósito', 'Senhor, que meu trabalho seja feito para Ti, mesmo quando ninguém está vendo. Dá-me clareza sobre o propósito que colocaste em mim, e coragem para caminhar nele, mesmo com incertezas. Abre portas que ninguém pode fechar, e me ajuda a confiar em Ti nos tempos de espera e de decisão.'),
  (7, '👨‍👩‍👧', 'Relações e Família', 'Deus, cura o que está quebrado nas minhas relações de família. Onde há distância, aproxima; onde há mágoa, restaura; onde há silêncio, abre um caminho de reconciliação, se for da Tua vontade. Ensina-me a amar quem é difícil de amar, começando por mim mesma.')
on conflict (id) do nothing;

-- =====================================================================
-- FIM. Depois de rodar isso, volte para a conversa e me avise
-- para eu finalizar o site com a conexão a essas tabelas.
-- =====================================================================
