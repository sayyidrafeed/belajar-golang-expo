import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, colors, Icon, serif } from '../../../components/ui';
import { spaceActivation } from '../../../lib/spaceActivation';
import { dateKey, tomorrowKey, validDate } from '../dates';
import type { Priority, Todo, TodoDraft } from '../types';

export function TaskEditor({ task, busy, apiError, onClose, onSave, onDelete }: {
  task: Todo | null;
  busy: boolean;
  apiError: string;
  onClose: () => void;
  onSave: (draft: TodoDraft) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [validation, setValidation] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit() {
    const cleanTitle = title.trim();
    const cleanDate = dueDate.trim();
    if (!cleanTitle) { setValidation('Give your task a title.'); return; }
    if ([...cleanTitle].length > 180) { setValidation('Keep the title within 180 characters.'); return; }
    if ([...notes.trim()].length > 4000) { setValidation('Keep notes within 4,000 characters.'); return; }
    if (cleanDate && !validDate(cleanDate)) { setValidation('Use a valid date, like 2026-10-15.'); return; }
    setValidation('');
    if (await onSave({ title: cleanTitle, notes: notes.trim(), priority, dueDate: cleanDate })) onClose();
  }

  function close() { if (!busy) onClose(); }

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <Pressable accessibilityLabel="Close task editor" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>{task ? 'A LITTLE ADJUSTMENT' : 'MAKE SOME ROOM'}</Text>
              <Text accessibilityRole="header" style={s.heading}>{task ? 'Edit task.' : 'One thing at a time.'}</Text>
            </View>
            <Button variant="quiet" label="Close task editor" onPress={close} disabled={busy} style={s.close}><Icon name="close" /></Button>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
            <Text style={s.label}>What needs doing?</Text>
            <TextInput
              autoFocus accessibilityLabel="Task title" editable={!busy}
              value={title} onChangeText={setTitle} placeholder="Give it a clear, simple title"
              placeholderTextColor={colors.muted} maxLength={180} style={s.input}
              onSubmitEditing={() => void submit()} returnKeyType="done"
            />
            <Text style={[s.label, { marginTop: 24 }]}>A little context <Text style={s.optional}>optional</Text></Text>
            <TextInput accessibilityLabel="Task notes" editable={!busy} multiline value={notes} onChangeText={setNotes} maxLength={4000}
              placeholder="Details, a next step, or something to remember..." placeholderTextColor={colors.muted} style={[s.input, s.notes]} />
            <Text style={[s.label, { marginTop: 24 }]}>Priority</Text>
            <View style={s.options}>
              {(['low', 'normal', 'high'] as const).map((value) => (
                <Pressable {...spaceActivation(() => setPriority(value), busy)} key={value} accessibilityRole="radio" accessibilityLabel={`${value} priority`} accessibilityState={{ checked: priority === value, disabled: busy }} disabled={busy} onPress={() => setPriority(value)}
                  style={({ pressed }) => [s.option, priority === value && s.selected, pressed && { opacity: .7 }]}>
                  <Text style={[s.optionText, priority === value && { color: colors.green }]}>{value === 'high' ? 'High' : value === 'low' ? 'Low' : 'Normal'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[s.label, { marginTop: 24 }]}>Due date <Text style={s.optional}>optional</Text></Text>
            <View style={s.options}>
              {[['Today', dateKey()], ['Tomorrow', tomorrowKey()], ['No date', '']].map(([label, value]) => (
                <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Due ${label.toLowerCase()}`} accessibilityState={{ selected: dueDate === value, disabled: busy }} disabled={busy} onPress={() => setDueDate(value)}
                  style={({ pressed }) => [s.option, dueDate === value && s.selected, pressed && { opacity: .7 }]}>
                  <Text style={[s.optionText, dueDate === value && { color: colors.green }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput accessibilityLabel="Custom due date, YYYY-MM-DD" editable={!busy} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted}
              maxLength={10} autoCorrect={false} autoCapitalize="none" style={[s.input, { marginTop: 12 }]} />
            <Text style={s.helper}>Pick a shortcut or enter a date. Past dates are allowed.</Text>
            {!!(validation || apiError) && <Text accessibilityRole="alert" style={s.error}>{validation || apiError}</Text>}
          </ScrollView>
          <View style={s.footer}>
            {confirmDelete ? <View style={{ flex: 1, gap: 14 }}>
              <Text style={{ color: colors.ink, fontSize: 14, lineHeight: 21 }}>Delete this task? This cannot be undone.</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Button variant="secondary" onPress={() => setConfirmDelete(false)} disabled={busy}>Keep task</Button>
                <Button variant="danger" onPress={() => void onDelete().then((ok) => { if (ok) onClose(); })} disabled={busy}>{busy ? 'Deleting...' : 'Yes, delete task'}</Button>
              </View>
            </View> : <>
              <Button variant="quiet" onPress={task ? () => setConfirmDelete(true) : close} disabled={busy}>{task ? <Text style={{ color: colors.red }}>Delete task</Text> : 'Cancel'}</Button>
              <Button variant="primary" onPress={() => void submit()} disabled={busy}>{busy ? 'Saving...' : task ? 'Save changes' : 'Add task'}</Button>
            </>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28, 30, 25, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '92%', backgroundColor: colors.paper, borderRadius: 18, overflow: 'hidden' },
  header: { padding: 26, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  eyebrow: { color: colors.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '600', marginBottom: 8 },
  heading: { color: colors.ink, fontFamily: serif, fontSize: 30, lineHeight: 37, letterSpacing: -.7 },
  close: { width: 44, paddingHorizontal: 10 },
  form: { padding: 26, paddingTop: 22 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 10 },
  optional: { fontWeight: '400', color: colors.muted, fontSize: 12 },
  input: { borderWidth: 1, borderColor: '#CECEC2', borderRadius: 8, backgroundColor: colors.white, color: colors.ink, minHeight: 48, padding: 13, fontSize: 16 },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  options: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.white },
  selected: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  optionText: { color: colors.ink, fontSize: 14 },
  helper: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 8 },
  error: { color: colors.red, fontSize: 14, lineHeight: 21, marginTop: 20 },
  footer: { padding: 20, paddingHorizontal: 26, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
