# Dialog System

## Overview

Growtopia uses a custom markup language for all UI dialogs — registration forms, item info, lock settings, vending machines, etc. The server sends dialog markup as a string via the `OnDialogRequest` variant, and the client renders it as a popup.

## Sending a Dialog

```
Variant[0] = "OnDialogRequest"
Variant[1] = dialog_markup_string
```

## Markup Elements

Each line is one UI element. Format: `element_type|param1|param2|...\n`

### Labels and Text

```
add_label_with_icon|big|Title Text|left|item_id|
add_label_with_icon|small|Smaller text|left|item_id|
add_textbox|Some paragraph text here.|left|
add_smalltext|Smaller text line|
```

- `big` / `small` controls font size
- `left` / `right` controls alignment
- `item_id` shows that item's icon next to the label

### Input Fields

```
add_text_input|field_id|Label:|default_value|max_length|
add_text_input_password|field_id|Password:||30|
```

- `field_id` is the key returned in dialog_return
- `max_length` limits character input

### Buttons

```
add_button|button_id|Button Text|noflags|0|0|
add_button_with_icon|button_id|Button Text|staticBlueFrame|item_id|
```

- `noflags` = normal button
- `staticBlueFrame` = styled button with icon

### Checkboxes

```
add_checkbox|check_id|Label text|0|
```

- Last param: `0` = unchecked, `1` = checked by default

### Item Picker

```
add_item_picker|picker_id|Choose an item|Select something|
```

Opens the player's inventory to pick an item.

### Spacers and Layout

```
add_spacer|small|
add_spacer|big|
```

### Embedded Data (Hidden)

```
embed_data|key|value
```

Not visible to the player. Sent back in dialog_return for server-side context.

### Player Info

```
add_player_info|name|level|xp|...
```

Shows a player info panel.

### Dialog End

```
end_dialog|dialog_name|Submit Button Text||
add_quick_exit|
```

- `dialog_name` is returned in the `dialog_return` action so the server knows which dialog was submitted
- `add_quick_exit` adds an X button to close without submitting

### Color and Formatting

```
set_default_color|`o
```

Sets the default text color for subsequent elements.

## Color Codes

Used in dialog text, chat, player names — anywhere text is displayed:

```
`0  White         `1  Cyan          `2  Green
`3  Light Blue    `4  Red           `5  Purple
`6  Gold/Yellow   `7  Gray          `8  Orange
`9  Yellow        `a  Pale Yellow   `b  Pale Green
`c  Pink          `d  Lavender      `e  Beige
`w  White (bold)  `o  Reset/Default `p  Rainbow (animated)
`q  Teal          ``  Literal backtick
```

## Dialog Return

When the player submits a dialog, the client sends a `GAME_MESSAGE` (type 3):

```
action|dialog_return
dialog_name|the_name_from_end_dialog
tilex|X
tiley|Y
field_id|user_input_value
check_id|1
picker_id|selected_item_id
buttonClicked|which_button_was_pressed
```

- `tilex`/`tiley`: the tile that was wrenched to open this dialog (-1 if not tile-based)
- Each input field returns its `field_id` with the user's value
- Checkboxes return `1` if checked (absent if unchecked)
- `buttonClicked` tells you which button triggered the submit

## Example: Registration Dialog

```
set_default_color|`o
add_label_with_icon|big|`wCreate Account|left|206|
add_spacer|small|
add_textbox|Choose a GrowID. This will be your username.|left|
add_text_input|growid|GrowID:||18|
add_text_input_password|password|Password:||30|
add_text_input_password|verify|Verify Password:||30|
add_spacer|small|
add_textbox|By creating an account you agree to the rules.|left|
end_dialog|registration|Create!||
add_quick_exit|
```

## Example: Lock Settings Dialog

```
set_default_color|`o
add_label_with_icon|big|`wWorld Lock|left|242|
add_spacer|small|
add_checkbox|checkbox_public|Allow anyone to Build and Break|0|
add_checkbox|checkbox_disable_music|Disable Custom Music Blocks|0|
add_text_input|minimum_entry_level|Minimum Entry Level:|0|3|
add_spacer|small|
add_button|recalculate|Re-apply lock|noflags|0|0|
end_dialog|lock_edit|OK||
add_quick_exit|
embed_data|tilex|50
embed_data|tiley|24
```
