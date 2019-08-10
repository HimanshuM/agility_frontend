class AgNavbar extends Component {
	templateUrl = "/js/components/ag_navbar/ag_navbar.html";
	selector = "ag-navbar";
	styleSheets = ["/js/components/ag_navbar/ag_navbar.css"];
	onInit() {
		var navbar = this.element.find(".ag-navbar")[0];
		for (var i = 0; i < this.$children.length; i++) {
			navbar.nativeElement.appendChild(this.$children[i]);
		}
	}
}