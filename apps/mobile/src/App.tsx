import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, Icon, serif } from './components/ui';
import { dateKey } from './features/todos/dates';
import { TaskEditor } from './features/todos/components/TaskEditor';
import { TodoItem } from './features/todos/components/TodoItem';
import type { SortOrder, Todo, TodoDraft, ViewFilter } from './features/todos/types';
import { useTodos } from './features/todos/useTodos';
import { preparePlatform } from './platform';
import { spaceActivation } from './lib/spaceActivation';

const views: { id: ViewFilter; label: string; heading: string; description: string }[] = [
  { id: 'all', label: 'All tasks', heading: 'Room for what matters.', description: 'A place for everything you want to do.' },
  { id: 'today', label: 'Today', heading: 'One day at a time.', description: 'Due today or overdue. Start with one thing.' },
  { id: 'upcoming', label: 'Upcoming', heading: 'A little looking ahead.', description: 'Make a little space for what comes next.' },
  { id: 'important', label: 'High priority', heading: 'First things first.', description: 'The things that deserve your attention.' },
  { id: 'completed', label: 'Completed', heading: 'Look what you did.', description: 'Every small thing adds up.' },
];

export default function App() {
  useEffect(() => { preparePlatform(); }, []);
  return <SafeAreaProvider><Workspace /></SafeAreaProvider>;
}

function Workspace() {
  const state = useTodos();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const rail = width >= 1260;
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('smart');
  const [draft, setDraft] = useState('');
  const [editor, setEditor] = useState<Todo | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [today, setToday] = useState(dateKey());
  const input = useRef<TextInput>(null);
  const blocked = state.busy || !state.loaded;

  useEffect(() => {
    const interval = setInterval(() => setToday(dateKey()), 60_000);
    const subscription = AppState.addEventListener('change', () => setToday(dateKey()));
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const currentView = views.find((view) => view.id === filter)!;
  const completed = state.todos.filter((todo) => todo.completed).length;
  const active = state.todos.filter((todo) => !todo.completed);
  const counts = {
    all: active.length,
    today: active.filter((todo) => todo.dueDate && todo.dueDate <= today).length,
    upcoming: active.filter((todo) => todo.dueDate > today).length,
    important: active.filter((todo) => todo.priority === 'high').length,
    completed,
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return state.todos.filter((todo) => {
      const matches = !needle || `${todo.title} ${todo.notes}`.toLocaleLowerCase().includes(needle);
      if (!matches) return false;
      if (filter === 'completed') return todo.completed;
      if (todo.completed) return false;
      if (filter === 'today') return !!todo.dueDate && todo.dueDate <= today;
      if (filter === 'upcoming') return todo.dueDate > today;
      if (filter === 'important') return todo.priority === 'high';
      return true;
    }).sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
      const priority = { high: 0, normal: 1, low: 2 };
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || priority[a.priority] - priority[b.priority] || a.createdAt.localeCompare(b.createdAt);
    });
  }, [state.todos, filter, query, sort, today]);

  function selectView(value: ViewFilter) { setFilter(value); setQuery(''); }
  function openEditor(task: Todo | 'new') { state.clearError(); setEditor(task); }

  async function quickAdd() {
    const title = draft.trim();
    if (!title) { setInlineError('Give your task a title.'); input.current?.focus(); return; }
    const capturedDraft = draft;
    setInlineError('');
    const dueDate = filter === 'today' ? today : '';
    const priority = filter === 'important' ? 'high' : 'normal';
    if (await state.create({ title, notes: '', dueDate, priority })) {
      setDraft((current) => current === capturedDraft ? '' : current);
      if (filter === 'completed' || filter === 'upcoming') setFilter('all');
      setQuery('');
      setNotice('A little less to remember. Task added.');
      input.current?.focus();
    }
  }

  async function saveEditor(data: TodoDraft) {
    const editing = editor && editor !== 'new';
    const ok = editing ? await state.update(editor.id, data) : await state.create(data);
    if (ok) {
      if (!editing) { setFilter('all'); setQuery(''); }
      setNotice(editing ? 'Changes saved.' : 'Task added. You’ve got this.');
    }
    return ok;
  }

  const navigation = views.map((view) => (
    <Pressable {...spaceActivation(() => selectView(view.id))} key={view.id} accessibilityRole="tab" accessibilityState={{ selected: filter === view.id }} accessibilityLabel={`${view.label}, ${counts[view.id]} tasks`}
      onPress={() => selectView(view.id)} style={({ pressed }) => [s.navItem, !desktop && s.mobileNavItem, filter === view.id && s.navActive, pressed && { opacity: .75 }]}>
      <Icon name={view.id} color={filter === view.id ? colors.ink : colors.muted} size={19} />
      <Text style={[s.navText, filter === view.id && { color: colors.ink, fontWeight: '600' }]}>{view.label}</Text>
      <Text style={[s.navCount, filter === view.id && { color: colors.ink }]}>{state.loaded ? counts[view.id] : '·'}</Text>
    </Pressable>
  ));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={[s.shell, { flexDirection: desktop ? 'row' : 'column' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {desktop ? <View style={s.sidebar}>
          <Text style={s.brand}>To-Dos<Text style={{ color: colors.orange }}>.</Text></Text>
          <Text style={s.brandSub}>A little less on your mind.</Text>
          <Button variant="primary" disabled={blocked} onPress={() => openEditor('new')} style={{ marginTop: 34 }}>+ New task</Button>
          <Text style={s.navLabel}>YOUR SPACE</Text>
          <View accessibilityRole="tablist" style={{ gap: 6 }}>{navigation}</View>
          <View style={s.sideFoot}>
            <View style={s.sideFootRule} />
            <Text style={s.sideFootTitle}>Small steps. Real progress.</Text>
            <Text style={s.sideFootCopy}>You don’t have to do it all today.</Text>
          </View>
        </View> : <View style={s.mobileHeader}>
          <View style={s.mobileBrandRow}>
            <Text style={[s.brand, { fontSize: 29 }]}>To-Dos<Text style={{ color: colors.orange }}>.</Text></Text>
            <Button variant="primary" disabled={blocked} onPress={() => openEditor('new')}>+ New task</Button>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingBottom: 12 }}>
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6 }}>{navigation}</View>
          </ScrollView>
        </View>}

        <ScrollView style={s.mainScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.main, !desktop && s.mainMobile]}>
          <View style={s.topline}>
            <Text style={s.date}>{new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
            <Button variant="quiet" label="Refresh task list" onPress={() => void state.refresh()} disabled={state.busy || state.loading} style={s.refresh}>
              {state.loading ? <ActivityIndicator size="small" color={colors.muted} /> : <Icon name="refresh" color={colors.muted} size={18} />}
            </Button>
          </View>
          <Text accessibilityRole="header" style={[s.heading, !desktop && { fontSize: 39, lineHeight: 46 }]}>{currentView.heading}</Text>
          <Text style={s.description}>{currentView.description}</Text>

          <View style={[s.workArea, !rail && { gap: 0 }]}>
            <View style={s.listColumn}>
              <View style={s.composer}>
                <Icon name="plus" color={colors.orange} size={22} />
                <TextInput ref={input} accessibilityLabel="Quick task title" placeholder="What needs doing?" placeholderTextColor={colors.muted}
                  value={draft} onChangeText={(value) => { setDraft(value); setInlineError(''); }} maxLength={180}
                  onSubmitEditing={() => void quickAdd()} returnKeyType="done" style={s.quickInput} editable={!blocked} />
                <Button variant="quiet" label="Add quick task" disabled={blocked} onPress={() => void quickAdd()} style={s.quickAdd}>{state.busy ? '...' : 'Add'}</Button>
              </View>
              <Text style={s.composerHelp}>{filter === 'today' ? 'New tasks here are due today.' : filter === 'important' ? 'New tasks here get high priority.' : 'One thought, one task. Press Enter to add.'}</Text>
              {!!inlineError && <Text accessibilityRole="alert" style={s.errorText}>{inlineError}</Text>}

              {!!state.error && !editor && <View accessibilityRole="alert" style={s.errorBanner}>
                <Text style={s.errorTitle}>{state.loaded ? 'That didn’t go through.' : 'Your list is out of reach.'}</Text>
                <Text style={s.errorMessage}>{state.error}</Text>
                <Button variant="secondary" onPress={() => void state.refresh()} disabled={state.busy || state.loading} style={{ alignSelf: 'flex-start', marginTop: 12 }}>Try again</Button>
              </View>}

              <View style={[s.listTools, !desktop && { flexWrap: 'wrap' }]}>
                <Text accessibilityRole="header" style={s.listHeading}>{currentView.label} <Text style={s.listCount}>{state.loaded ? filtered.length : '·'}</Text></Text>
                <View style={s.toolRight}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Sort tasks. Current: ${sort === 'smart' ? 'due date' : sort}. Activate to change.`} onPress={() => setSort(sort === 'smart' ? 'newest' : sort === 'newest' ? 'title' : 'smart')} style={({ pressed }) => [s.sort, pressed && { opacity: .6 }]}>
                    <Text style={s.sortText}>Sort: {sort === 'smart' ? 'Due date' : sort === 'newest' ? 'Newest' : 'A–Z'}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={s.search}>
                <Icon name="search" size={17} color={colors.muted} />
                <TextInput accessibilityLabel="Search task titles and notes" value={query} onChangeText={setQuery} placeholder="Find a task..." placeholderTextColor={colors.muted} style={s.searchInput} returnKeyType="search" />
                {!!query && <Button variant="quiet" label="Clear search" onPress={() => setQuery('')} style={s.clearSearch}><Icon name="close" size={15} color={colors.muted} /></Button>}
              </View>

              {state.loading && !state.loaded ? <View style={s.empty}>
                <ActivityIndicator color={colors.green} />
                <Text style={s.emptyDescription}>Gathering your tasks...</Text>
              </View> : state.loaded && filtered.length > 0 ? <View>
                {filtered.map((todo) => <TodoItem key={todo.id} todo={todo} compact={!desktop} busy={state.busy}
                  onEdit={() => openEditor(todo)} onToggle={() => void state.update(todo.id, { completed: !todo.completed }).then((ok) => { if (ok) setNotice(todo.completed ? 'Task reopened.' : 'One less thing. Nicely done.'); })} />)}
                <Text style={s.listEnd}>{filter === 'completed' ? 'Done is a good place to be.' : 'That’s your list. Take it one thing at a time.'}</Text>
              </View> : state.loaded && <View style={s.empty}>
                <View style={s.emptyCheck}><Icon name={filter === 'completed' ? 'check' : 'plus'} color={colors.green} size={28} /></View>
                <Text style={s.emptyHeading}>{query ? 'Nothing by that name.' : filter === 'completed' ? 'Good things take a first step.' : filter === 'all' ? 'A fresh page.' : 'A little breathing room.'}</Text>
                <Text style={s.emptyDescription}>{query ? 'Try another word, or clear your search.' : filter === 'completed' ? 'Tasks you finish will find a home here.' : filter === 'all' ? 'Get that first thing out of your head\nand onto your list.' : `No ${filter === 'today' ? 'tasks due today or overdue' : filter === 'upcoming' ? 'upcoming tasks' : 'high-priority tasks'} right now.`}</Text>
                {query ? <Button onPress={() => setQuery('')} style={{ marginTop: 22 }}>Clear search</Button> : filter !== 'completed' && <Button onPress={() => openEditor('new')} disabled={blocked} style={{ marginTop: 22 }}>+ Add a task</Button>}
              </View>}
            </View>

            {rail && <View style={s.rail}>
              <View style={s.progressNote}>
                <Text style={s.noteEyebrow}>THE BIG PICTURE</Text>
                <View style={s.progressNumbers}><Text style={s.progressNumber}>{state.loaded ? completed : '·'}</Text><Text style={s.progressSlash}>/ {state.loaded ? state.todos.length : '·'}</Text></View>
                <Text style={s.progressLabel}>tasks completed</Text>
                <View style={s.progressTrack}><View style={[s.progressFill, { width: `${state.todos.length ? completed / state.todos.length * 100 : 0}%` }]} /></View>
                <Text style={s.noteCopy}>{state.todos.length === 0 ? 'Progress starts with putting one thing on the page.' : completed === state.todos.length ? 'All caught up. Make some room for yourself.' : 'Every checkmark is a little more room in your day.'}</Text>
              </View>
              <View style={s.marginNote}>
                <Text style={s.marginNumber}>01 / A SMALL REMINDER</Text>
                <Text style={s.marginQuote}>{'Make it small\nenough to start.'}</Text>
                <Text style={s.marginCopy}>A clear next step beats a perfect plan. You can figure out the rest along the way.</Text>
              </View>
            </View>}
          </View>
          {!rail && state.loaded && state.todos.length > 0 && <Text style={s.bottomProgress}>{completed} of {state.todos.length} tasks completed. Every small thing counts.</Text>}
          <Text style={s.footer}>A little intention goes a long way.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {!!notice && <View accessibilityLiveRegion="polite" style={[s.toast, !desktop && { left: 16, right: 16, bottom: 20 }]}>
        <Icon name="check" color={colors.white} size={17} />
        <Text style={s.toastText}>{notice}</Text>
        <Button variant="quiet" label="Dismiss notification" onPress={() => setNotice('')} style={{ paddingHorizontal: 6, minHeight: 30 }}><Icon name="close" color={colors.white} size={15} /></Button>
      </View>}

      {editor && <TaskEditor key={editor === 'new' ? 'new' : editor.id} task={editor === 'new' ? null : editor} busy={state.busy} apiError={state.error}
        onClose={() => setEditor(null)} onSave={saveEditor}
        onDelete={async () => {
          if (editor === 'new') return false;
          const ok = await state.remove(editor.id);
          if (ok) setNotice('Task deleted. A little more space.');
          return ok;
        }} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  shell: { flex: 1 },
  sidebar: { width: 244, backgroundColor: colors.sidebar, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 30, borderRightWidth: 1, borderRightColor: colors.line },
  brand: { fontFamily: serif, color: colors.ink, fontSize: 34, lineHeight: 42, letterSpacing: -1.3, fontWeight: '700' },
  brandSub: { fontSize: 12, color: colors.muted, marginTop: 5 },
  navLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: '600', color: colors.muted, marginTop: 40, marginBottom: 14, paddingLeft: 10 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, minHeight: 46, borderRadius: 7 },
  navActive: { backgroundColor: '#E2E5D9' },
  navText: { color: colors.muted, fontSize: 14, flex: 1 },
  navCount: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  mobileNavItem: { gap: 8, paddingHorizontal: 12 },
  sideFoot: { marginTop: 'auto', paddingTop: 50, paddingHorizontal: 8 },
  sideFootRule: { width: 28, height: 2, backgroundColor: colors.green, marginBottom: 16 },
  sideFootTitle: { color: colors.ink, fontFamily: serif, fontSize: 16, lineHeight: 23 },
  sideFootCopy: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 7 },
  mobileHeader: { backgroundColor: colors.sidebar, borderBottomWidth: 1, borderBottomColor: colors.line },
  mobileBrandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 14 },
  mainScroll: { flex: 1 },
  main: { paddingHorizontal: 56, paddingTop: 32, paddingBottom: 26, width: '100%', maxWidth: 1190, alignSelf: 'center' },
  mainMobile: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 22 },
  date: { color: colors.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '600', flex: 1 },
  refresh: { paddingHorizontal: 10, width: 44 },
  heading: { fontFamily: serif, color: colors.ink, fontSize: 52, lineHeight: 62, letterSpacing: -1.8, maxWidth: 670 },
  description: { fontSize: 14, lineHeight: 23, color: colors.muted, marginTop: 12 },
  workArea: { flexDirection: 'row', alignItems: 'flex-start', gap: 40, marginTop: 38 },
  listColumn: { flex: 1, minWidth: 0 },
  composer: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#CECEC2', borderRadius: 10, minHeight: 64, paddingLeft: 18, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickInput: { flex: 1, minWidth: 0, color: colors.ink, paddingVertical: 18, fontSize: 16 },
  quickAdd: { paddingHorizontal: 12 },
  composerHelp: { fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 10, paddingLeft: 2 },
  errorText: { color: colors.red, fontSize: 13, marginTop: 8 },
  errorBanner: { backgroundColor: '#F9EEE9', padding: 18, borderRadius: 8, marginTop: 22 },
  errorTitle: { color: colors.red, fontWeight: '600', fontSize: 14 },
  errorMessage: { color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 6 },
  listTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 36, marginBottom: 16 },
  listHeading: { fontSize: 17, fontWeight: '600', color: colors.ink },
  listCount: { fontSize: 13, color: colors.muted, fontWeight: '400' },
  toolRight: { flexDirection: 'row', alignItems: 'center' },
  sort: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  sortText: { color: colors.muted, fontSize: 11 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 8 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 10, color: colors.ink },
  clearSearch: { width: 44, paddingHorizontal: 10 },
  listEnd: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 28, lineHeight: 18 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 12, minHeight: 300 },
  emptyCheck: { width: 62, height: 62, backgroundColor: colors.greenSoft, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyHeading: { fontFamily: serif, color: colors.ink, fontSize: 27, lineHeight: 34, textAlign: 'center' },
  emptyDescription: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  rail: { width: 228, gap: 34 },
  progressNote: { backgroundColor: '#EAEDE2', padding: 25, borderRadius: 12 },
  noteEyebrow: { color: colors.green, fontSize: 9, letterSpacing: 1.1, fontWeight: '600' },
  progressNumbers: { flexDirection: 'row', alignItems: 'baseline', marginTop: 24, gap: 6 },
  progressNumber: { color: colors.green, fontFamily: serif, fontSize: 58, lineHeight: 68, letterSpacing: -2 },
  progressSlash: { color: colors.green, fontFamily: serif, fontSize: 25 },
  progressLabel: { fontSize: 12, color: colors.green, marginTop: 2 },
  progressTrack: { height: 4, backgroundColor: '#C9D2BF', borderRadius: 2, marginTop: 22, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.green, borderRadius: 2 },
  noteCopy: { color: colors.green, fontSize: 12, lineHeight: 20, marginTop: 18 },
  marginNote: { paddingHorizontal: 10 },
  marginNumber: { fontSize: 9, color: colors.muted, letterSpacing: .8, marginBottom: 14 },
  marginQuote: { fontFamily: serif, color: colors.ink, fontSize: 25, lineHeight: 33, letterSpacing: -.4 },
  marginCopy: { fontSize: 12, color: colors.muted, lineHeight: 21, marginTop: 13 },
  bottomProgress: { fontSize: 12, color: colors.green, lineHeight: 20, marginTop: 34, textAlign: 'center' },
  footer: { color: colors.muted, fontFamily: serif, fontSize: 12, textAlign: 'center', marginTop: 60, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.line },
  toast: { position: 'absolute', right: 28, bottom: 28, backgroundColor: colors.ink, borderRadius: 10, paddingVertical: 12, paddingLeft: 18, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 460 },
  toastText: { color: colors.white, fontSize: 13, lineHeight: 20, flexShrink: 1 },
});
