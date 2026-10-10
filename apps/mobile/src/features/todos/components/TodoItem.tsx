import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, Icon } from '../../../components/ui';
import { spaceActivation } from '../../../lib/spaceActivation';
import { dateKey, dueLabel } from '../dates';
import type { Todo } from '../types';

export function TodoItem({ todo, compact, busy, onToggle, onEdit }: {
  todo: Todo; compact: boolean; busy: boolean; onToggle: () => void; onEdit: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const overdue = !todo.completed && todo.dueDate !== '' && todo.dueDate < dateKey();
  return (
    <View style={[s.row, compact && { paddingVertical: 18 }]}>
      <Pressable {...spaceActivation(onToggle, busy)} accessibilityRole="checkbox" accessibilityState={{ checked: todo.completed, disabled: busy }}
        accessibilityLabel={`${todo.completed ? 'Reopen' : 'Complete'} ${todo.title}`} disabled={busy} onPress={onToggle}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={({ pressed }) => [s.checkTarget, pressed && { opacity: .6 }]}>
        <View style={[s.checkbox, todo.completed && s.checked, focused && { borderColor: colors.orange, outlineColor: colors.orange, outlineWidth: 2, outlineOffset: 4 }]}>
          {todo.completed && <Icon name="check" size={17} color={colors.white} />}
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${todo.title}`} onPress={onEdit} disabled={busy}
        style={({ pressed }) => [s.taskBody, pressed && { opacity: .7 }]}>
        <View style={{ gap: 6 }}>
          <Text style={[s.title, todo.completed && s.done]}>{todo.title}</Text>
          {!!todo.notes && <Text numberOfLines={2} style={s.notes}>{todo.notes}</Text>}
          <View style={s.meta}>
            {!!todo.dueDate && <View style={s.metaPiece}><Icon name="today" size={13} color={overdue ? colors.red : colors.muted} /><Text style={[s.metaText, overdue && { color: colors.red }]}>{overdue ? `Overdue · ${dueLabel(todo.dueDate)}` : dueLabel(todo.dueDate)}</Text></View>}
            {todo.priority !== 'normal' && <View style={[s.priority, todo.priority === 'high' && { backgroundColor: colors.orangeSoft }]}><Text style={[s.metaText, todo.priority === 'high' && { color: colors.orange }]}>{todo.priority === 'high' ? 'High priority' : 'Low priority'}</Text></View>}
          </View>
        </View>
      </Pressable>
      {!compact && <Text style={s.editHint}>Edit</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 22, gap: 14 },
  checkTarget: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: -8, marginLeft: -8 },
  checkbox: { width: 23, height: 23, borderWidth: 1.5, borderColor: '#7E8577', borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: colors.green, borderColor: colors.green },
  taskBody: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  notes: { fontSize: 13, lineHeight: 20, color: colors.muted },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  metaPiece: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  metaText: { fontSize: 11, lineHeight: 17, color: colors.muted },
  priority: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.sidebar },
  editHint: { fontSize: 11, color: colors.muted, paddingLeft: 8 },
});
