import * as React from "react";
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDownIcon } from "@radix-ui/react-icons";
import styles from './CustomDropdown.module.css';

const extensions = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'svg', 'tga'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'ogv', 'webm'],
  audio: ['mp3', 'wav', 'ogg', 'aac', 'flac'],
};

interface CustomDropdownProps {
  fileType: 'image' | 'video' | 'audio'
}

const CustomDropdown = ({ fileType }: CustomDropdownProps) => {
  const [selected, setSelected] = React.useState("");

  const fileExtensions = extensions[fileType];

  return (
    <section className= {styles.dropdown}>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={styles.dropdownButton}>
        <span>{selected || `Select a format`}</span>
        <ChevronDownIcon />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className={styles.dropdownMenu}>
        <DropdownMenu.Item className={styles.dropdownItem} onClick={() => setSelected("")}>
          Clear selection
        </DropdownMenu.Item>
        <DropdownMenu.Separator className={styles.separator} />
        <div className={styles.dropdownColumns}>
          {fileExtensions.map((ext, index) => (
            <DropdownMenu.Item
              key={index}
              className={styles.dropdownItem}
              onClick={() => setSelected(ext)}
            >
              {ext}
            </DropdownMenu.Item>
          ))}
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    </section>

  );
}

export default CustomDropdown;
